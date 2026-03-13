/**
 * Dev Optimizer GitHub Action
 * Analyzes repository and posts PR comments
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Finding {
  id: string;
  domain: string;
  title: string;
  severity: string;
  confidence: string;
  description: string;
  suggestedFix: {
    type: string;
    file: string;
    description: string;
    autoFixable: boolean;
  };
}

interface AnalysisResult {
  score: number;
  findings: Finding[];
  savings: {
    timeSeconds: number;
    sizeMB: number;
  };
}

async function run(): Promise<void> {
  try {
    const inputs = {
      path: core.getInput('path') || '.',
      domains: core.getInput('domains') || 'all',
      format: core.getInput('format') || 'markdown',
      failOnIssues: core.getInput('fail-on-issues') === 'true',
      saveBaseline: core.getInput('save-baseline') === 'true',
      compareBaseline: core.getInput('compare-baseline') === 'true'
    };

    core.info(`Running dev-optimizer on ${inputs.path}`);
    core.info(`Domains: ${inputs.domains}`);
    core.info(`Format: ${inputs.format}`);

    // Install dev-optimizer if not available
    try {
      execSync('npx dev-optimizer --version', { stdio: 'ignore' });
    } catch {
      core.info('Installing dev-optimizer...');
      execSync('npm install -g dev-optimizer', { stdio: 'inherit' });
    }

    // Run analysis
    const analyzePath = path.resolve(inputs.path);
    const outputPath = '/tmp/dev-optimizer-report.json';

    let analyzeCmd = `npx dev-optimizer analyze --path ${analyzePath} --format json`;
    if (inputs.domains !== 'all') {
      analyzeCmd += ` --type ${inputs.domains}`;
    }

    core.info(`Running: ${analyzeCmd}`);
    execSync(analyzeCmd + ` > ${outputPath}`, { stdio: 'inherit' });

    // Parse results
    const report: AnalysisResult = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

    // Output summary
    core.info(`Score: ${report.score}/100`);
    core.info(`Findings: ${report.findings.length}`);
    core.info(`Savings: ${report.savings.sizeMB} MB, ${Math.round(report.savings.timeSeconds / 60)} min`);

    // Set outputs
    core.setOutput('findings-count', report.findings.length.toString());
    core.setOutput('score', report.score.toString());
    core.setOutput('report', outputPath);

    // Save baseline if requested
    if (inputs.saveBaseline) {
      const baselineCmd = `npx dev-optimizer baseline --save --path ${analyzePath}`;
      core.info('Saving baseline...');
      execSync(baselineCmd, { stdio: 'inherit' });
    }

    // Compare with baseline if requested
    if (inputs.compareBaseline) {
      const baselineCmd = `npx dev-optimizer baseline --compare --path ${analyzePath}`;
      const compareResult = execSync(baselineCmd, { encoding: 'utf-8' });
      core.info(compareResult);

      // Check for regression
      if (compareResult.includes('regression') || compareResult.includes('worse')) {
        core.setFailed('Baseline regression detected!');
        return;
      }
    }

    // Post PR comment if in PR context
    if (github.context.eventName === 'pull_request') {
      await postPRComment(report, inputs.format);
    }

    // Fail if issues found and fail-on-issues is true
    if (inputs.failOnIssues && report.findings.length > 0) {
      core.setFailed(`Found ${report.findings.length} issues`);
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

async function postPRComment(report: AnalysisResult, format: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning('GITHUB_TOKEN not set, skipping PR comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const prNumber = github.context.issue.number;

  if (!prNumber) {
    core.info('Not in PR context, skipping comment');
    return;
  }

  // Generate comment body
  const body = generateComment(report);

  // Find existing comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber
  });

  const botComment = comments.find(c => 
    c.user?.type === 'Bot' && 
    c.body?.includes('<!-- dev-optimizer-report -->')
  );

  if (botComment) {
    // Update existing comment
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: botComment.id,
      body
    });
    core.info('Updated existing PR comment');
  } else {
    // Create new comment
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body
    });
    core.info('Created new PR comment');
  }
}

function generateComment(report: AnalysisResult): string {
  const lines: string[] = [];
  
  lines.push('<!-- dev-optimizer-report -->');
  lines.push('## 🔍 Dev Optimizer Report');
  lines.push('');
  lines.push(`**Score:** ${report.score}/100`);
  lines.push(`**Findings:** ${report.findings.length}`);
  lines.push(`**Potential Savings:** ${report.savings.sizeMB} MB, ${Math.round(report.savings.timeSeconds / 60)} min`);
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('✅ No issues found. Great job!');
    return lines.join('\n');
  }

  // Group by severity
  const high = report.findings.filter(f => f.severity === 'high' || f.severity === 'critical');
  const medium = report.findings.filter(f => f.severity === 'medium');
  const low = report.findings.filter(f => f.severity === 'low');

  if (high.length > 0) {
    lines.push('### 🔴 High Priority');
    lines.push('');
    for (const f of high.slice(5)) {
      lines.push(`- **${f.title}** (${f.domain})`);
      lines.push(`  ${f.description}`);
      if (f.suggestedFix.autoFixable) {
        lines.push(`  ✅ Auto-fixable`);
      }
    }
    if (high.length > 5) {
      lines.push(`- ... and ${high.length - 5} more`);
    }
    lines.push('');
  }

  if (medium.length > 0) {
    lines.push('### 🟠 Medium Priority');
    lines.push('');
    for (const f of medium.slice(3)) {
      lines.push(`- **${f.title}** (${f.domain})`);
    }
    lines.push('');
  }

  if (low.length > 0) {
    lines.push('### 🟡 Low Priority');
    lines.push('');
    lines.push(`${low.length} suggestions`);
    lines.push('');
  }

  // Quick wins
  const quickWins = report.findings.filter(f => f.suggestedFix.autoFixable);
  if (quickWins.length > 0) {
    lines.push('### 💡 Quick Wins');
    lines.push('');
    lines.push(`${quickWins.length} issues can be auto-fixed:`);
    lines.push('```bash');
    lines.push('npx dev-optimizer fix --safe');
    lines.push('```');
    lines.push('');
  }

  lines.push('---');
  lines.push('*Powered by [dev-optimizer](https://github.com/bigcheburashka/dev-optimizer)*');

  return lines.join('\n');
}

// Export for testing
export { generateComment, run };
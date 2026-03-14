/**
 * Fix command
 * Apply safe optimizations automatically
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { DockerAnalyzer } from '../analyzers/DockerAnalyzer.js';
import { DepsAnalyzer } from '../analyzers/DepsAnalyzer.js';
import { CiAnalyzer } from '../analyzers/CiAnalyzer.js';
import { Finding, FixResult } from '../types.js';

interface FixOptions {
  path: string;
  dryRun: boolean;
  safe: boolean;
  interactive: boolean;
  domain?: 'docker' | 'deps' | 'ci' | 'all';
}

interface AppliedFix {
  finding: Finding;
  result: FixResult;
}

export async function fixCommand(options: FixOptions): Promise<void> {
  const projectPath = path.resolve(options.path);
  
  if (!fs.existsSync(projectPath)) {
    console.error(`Path not found: ${projectPath}`);
    process.exit(1);
  }

  console.log(`🔧 Dev Optimizer Fix\n`);
  console.log(`Path: ${projectPath}`);
  console.log(`Mode: ${options.dryRun ? 'dry-run (preview only)' : options.interactive ? 'interactive' : 'apply changes'}`);
  console.log(`Safety: ${options.safe ? 'safe fixes only' : 'all auto-fixable'}\n`);

  // Collect findings from all analyzers
  const allFindings: Finding[] = [];
  
  const dockerAnalyzer = new DockerAnalyzer();
  const depsAnalyzer = new DepsAnalyzer();
  const ciAnalyzer = new CiAnalyzer();

  // Docker findings
  if (options.domain === 'all' || options.domain === 'docker' || !options.domain) {
    if (await dockerAnalyzer.isApplicable(projectPath)) {
      console.log('🐳 Collecting Docker findings...');
      const result = await dockerAnalyzer.analyze(projectPath);
      allFindings.push(...result.findings);
    }
  }

  // Dependencies findings
  if (options.domain === 'all' || options.domain === 'deps' || !options.domain) {
    if (await depsAnalyzer.isApplicable(projectPath)) {
      console.log('📦 Collecting Dependencies findings...');
      const result = await depsAnalyzer.analyze(projectPath);
      allFindings.push(...result.findings);
    }
  }

  // CI findings
  if (options.domain === 'all' || options.domain === 'ci' || !options.domain) {
    if (await ciAnalyzer.isApplicable(projectPath)) {
      console.log('🔄 Collecting CI/CD findings...');
      const result = await ciAnalyzer.analyze(projectPath);
      allFindings.push(...result.findings);
    }
  }

  console.log(`\n📊 Found ${allFindings.length} issues\n`);

  // Filter auto-fixable findings
  const autoFixable = allFindings.filter(f => f.suggestedFix?.autoFixable);
  const safeFixable = autoFixable.filter(f => f.autoFixSafe);

  const toFix = options.safe ? safeFixable : autoFixable;

  console.log(`Auto-fixable: ${autoFixable.length}`);
  console.log(`Safe fixes: ${safeFixable.length}`);
  console.log(`Will apply: ${toFix.length}\n`);

  if (toFix.length === 0) {
    console.log('✅ No fixes to apply.\n');
    if (allFindings.length > 0) {
      console.log('💡 Run `dev-optimizer analyze` to see all issues.');
    }
    return;
  }

  // Interactive mode: ask for each fix
  if (options.interactive && !options.dryRun) {
    const approved: Finding[] = [];
    let applyAll = false;

    console.log('═'.repeat(60));
    console.log('Interactive mode: review each fix\n');

    for (const finding of toFix) {
      if (applyAll) {
        approved.push(finding);
        continue;
      }

      const icon = { docker: '🐳', deps: '📦', ci: '🔄' }[finding.domain] || '❓';
      console.log(`\n${icon} [${finding.severity.toUpperCase()}] ${finding.title}`);
      console.log(`   File: ${finding.suggestedFix.file}`);
      console.log(`   Action: ${finding.suggestedFix.description}`);
      if (finding.suggestedFix.diff) {
        console.log(`   Change:\n${finding.suggestedFix.diff.split('\n').map(l => '     ' + l).join('\n')}`);
      }

      const answer = await askQuestion('\n   Apply? (y=yes/n=no/a=all/q=quit) > ');
      
      if (answer.toLowerCase() === 'a') {
        approved.push(finding);
        applyAll = true;
        console.log('   ✅ Applying all remaining fixes...');
      } else if (answer.toLowerCase() === 'y') {
        approved.push(finding);
        console.log('   ✅ Will apply');
      } else if (answer.toLowerCase() === 'q') {
        console.log('\n   🛑 Quitting...\n');
        break;
      } else {
        console.log('   ⏭️  Skipping');
      }
    }

    if (approved.length === 0) {
      console.log('\n✅ No fixes selected.\n');
      return;
    }

    console.log(`\n📋 Selected ${approved.length} fixes to apply.\n`);
    
    // Apply approved fixes
    await applyFixes(projectPath, approved, options);
    return;
  }

  // Non-interactive mode: show planned fixes
  console.log('═'.repeat(60));
  console.log('Planned fixes:\n');

  for (const finding of toFix) {
    const icon = { docker: '🐳', deps: '📦', ci: '🔄' }[finding.domain] || '❓';
    console.log(`${icon} [${finding.severity.toUpperCase()}] ${finding.title}`);
    console.log(`   File: ${finding.suggestedFix.file}`);
    console.log(`   Action: ${finding.suggestedFix.description}\n`);
  }

  if (options.dryRun) {
    console.log('═'.repeat(60));
    console.log('\n📝 Dry-run mode: no changes will be made.\n');
    
    for (const finding of toFix) {
      if (finding.suggestedFix.diff) {
        console.log(`--- ${finding.suggestedFix.file} ---`);
        console.log(finding.suggestedFix.diff);
        console.log('');
      }
    }
    
    console.log('Run without --dry-run to apply these fixes.');
    return;
  }

  // Apply fixes in non-interactive mode
  await applyFixes(projectPath, toFix, options);
}

/**
 * Ask user a question via readline
 */
function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Apply fixes and show results
 */
async function applyFixes(projectPath: string, toFix: Finding[], options: FixOptions): Promise<void> {
  const applied: AppliedFix[] = [];
  const skipped: AppliedFix[] = [];
  const errors: { finding: Finding; error: string }[] = [];

  console.log('═'.repeat(60));
  console.log('\n🔨 Applying fixes...\n');

  for (const finding of toFix) {
    const result = await applyFix(projectPath, finding);
    
    if (result.applied) {
      applied.push({ finding, result });
      console.log(`✅ ${finding.title}`);
      if (result.diff) {
        console.log(`   ${finding.suggestedFix.file}`);
      }
    } else if (result.error) {
      errors.push({ finding, error: result.error });
      console.log(`❌ ${finding.title}: ${result.error}`);
    } else {
      skipped.push({ finding, result });
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Summary:\n');
  console.log(`✅ Applied: ${applied.length}`);
  console.log(`⏭️  Skipped: ${skipped.length}`);
  console.log(`❌ Errors: ${errors.length}\n`);

  if (errors.length > 0) {
    console.log('Failed fixes:\n');
    for (const { finding, error } of errors) {
      console.log(`  ${finding.title}: ${error}`);
    }
  }
}

/**
 * Apply a single fix
 */
async function applyFix(projectPath: string, finding: Finding): Promise<FixResult> {
  const fix = finding.suggestedFix;
  const filePath = path.join(projectPath, fix.file);

  try {
    switch (fix.type) {
      case 'create':
        return await createFile(filePath, fix, finding);
      
      case 'modify':
        return await modifyFile(filePath, fix, finding);
      
      case 'delete':
        return await deleteFile(filePath, fix, finding);
      
      default:
        return {
          findingId: finding.id,
          applied: false,
          file: fix.file,
          error: 'Unknown fix type'
        };
    }
  } catch (error: any) {
    return {
      findingId: finding.id,
      applied: false,
      file: fix.file,
      error: error.message || String(error)
    };
  }
}

/**
 * Create a new file
 */
async function createFile(filePath: string, fix: Finding['suggestedFix'], finding: Finding): Promise<FixResult> {
  if (fs.existsSync(filePath)) {
    return {
      findingId: finding.id,
      applied: false,
      file: fix.file,
      error: 'File already exists'
    };
  }

  // Ensure parent directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  const content = fix.diff || '';
  fs.writeFileSync(filePath, content, 'utf-8');

  return {
    findingId: finding.id,
    applied: true,
    file: fix.file,
    diff: fix.diff
  };
}

/**
 * Modify an existing file
 */
async function modifyFile(filePath: string, fix: Finding['suggestedFix'], finding: Finding): Promise<FixResult> {
  if (!fs.existsSync(filePath)) {
    return {
      findingId: finding.id,
      applied: false,
      file: fix.file,
      error: 'File not found'
    };
  }

  // Handle different fix types
  if (finding.id.startsWith('ci-004') || finding.id.includes('timeout')) {
    // Add timeout-minutes to GitHub Actions
    return await addTimeoutToGitHub(filePath, fix, finding);
  }

  if (finding.id.includes('artifact-retention')) {
    // Add retention-days to upload-artifact
    return await addRetentionToArtifact(filePath, fix, finding);
  }

  // For other modifications, return diff for manual review
  const content = fs.readFileSync(filePath, 'utf-8');
  
  return {
    findingId: finding.id,
    applied: false,
    file: fix.file,
    diff: fix.diff || `Suggestion: ${fix.description}`,
    error: 'Manual modification required'
  };
}

/**
 * Add timeout-minutes to GitHub Actions workflow
 */
async function addTimeoutToGitHub(filePath: string, fix: Finding['suggestedFix'], finding: Finding): Promise<FixResult> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const yaml = await import('yaml');
    const workflow = yaml.parse(content);

    if (!workflow.jobs) {
      return {
        findingId: finding.id,
        applied: false,
        file: fix.file,
        error: 'No jobs found in workflow'
      };
    }

    // Add timeout-minutes to each job
    for (const jobName of Object.keys(workflow.jobs)) {
      if (!workflow.jobs[jobName]['timeout-minutes']) {
        workflow.jobs[jobName]['timeout-minutes'] = 10;
      }
    }

    // Write back
    const newContent = yaml.stringify(workflow);
    fs.writeFileSync(filePath, newContent, 'utf-8');

    return {
      findingId: finding.id,
      applied: true,
      file: fix.file,
      diff: 'Added timeout-minutes: 10 to all jobs'
    };
  } catch (error: any) {
    return {
      findingId: finding.id,
      applied: false,
      file: fix.file,
      error: error.message || 'Failed to add timeout'
    };
  }
}

/**
 * Add retention-days to upload-artifact steps
 */
async function addRetentionToArtifact(filePath: string, fix: Finding['suggestedFix'], finding: Finding): Promise<FixResult> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const yaml = await import('yaml');
    const workflow = yaml.parse(content);

    if (!workflow.jobs) {
      return {
        findingId: finding.id,
        applied: false,
        file: fix.file,
        error: 'No jobs found in workflow'
      };
    }

    let modified = false;

    // Find upload-artifact steps
    for (const jobName of Object.keys(workflow.jobs)) {
      const job = workflow.jobs[jobName];
      if (job.steps && Array.isArray(job.steps)) {
        for (const step of job.steps) {
          if (step.uses && step.uses.includes('upload-artifact')) {
            if (!step.with) {
              step.with = {};
            }
            if (!step.with['retention-days']) {
              step.with['retention-days'] = 7;
              modified = true;
            }
          }
        }
      }
    }

    if (!modified) {
      return {
        findingId: finding.id,
        applied: false,
        file: fix.file,
        error: 'No upload-artifact steps found'
      };
    }

    // Write back
    const newContent = yaml.stringify(workflow);
    fs.writeFileSync(filePath, newContent, 'utf-8');

    return {
      findingId: finding.id,
      applied: true,
      file: fix.file,
      diff: 'Added retention-days: 7 to upload-artifact steps'
    };
  } catch (error: any) {
    return {
      findingId: finding.id,
      applied: false,
      file: fix.file,
      error: error.message || 'Failed to add retention'
    };
  }
}

/**
 * Modify a file (general case)
 */
async function modifyFileGeneral(filePath: string, fix: Finding['suggestedFix'], finding: Finding): Promise<FixResult> {
  // General modifications require manual review
  return {
    findingId: finding.id,
    applied: false,
    file: fix.file,
    diff: fix.diff || `Suggestion: ${fix.description}`,
    error: 'Manual modification required'
  };
}

/**
 * Delete a file
 */
async function deleteFile(filePath: string, fix: Finding['suggestedFix'], finding: Finding): Promise<FixResult> {
  if (!fs.existsSync(filePath)) {
    return {
      findingId: finding.id,
      applied: false,
      file: fix.file,
      error: 'File not found'
    };
  }

  // Deletions require manual review
  return {
    findingId: finding.id,
    applied: false,
    file: fix.file,
    error: 'Deletion requires manual review'
  };
}
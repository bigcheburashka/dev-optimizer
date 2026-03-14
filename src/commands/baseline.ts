/**
 * Baseline command
 * Manage baseline metrics for regression tracking
 */

import * as fs from 'fs';
import * as path from 'path';
import { DockerAnalyzer } from '../analyzers/DockerAnalyzer.js';
import { DepsAnalyzer } from '../analyzers/DepsAnalyzer.js';
import { CiAnalyzer } from '../analyzers/CiAnalyzer.js';
import { BaselineManager } from '../baseline/BaselineManager.js';

interface BaselineOptions {
  path: string;
  save: boolean;
  compare: boolean;
  history: boolean;
  'fail-on-regression': boolean;
  'min-score': number;
}

export async function baselineCommand(options: BaselineOptions): Promise<void> {
  const projectPath = path.resolve(options.path);
  
  if (!fs.existsSync(projectPath)) {
    console.error(`Path not found: ${projectPath}`);
    process.exit(1);
  }

  console.log(`📊 Baseline Manager\n`);
  console.log(`Path: ${projectPath}\n`);

  const manager = new BaselineManager(projectPath);

  // Save new baseline
  if (options.save) {
    console.log('Saving baseline...\n');
    
    // Collect current analysis
    const analyzers = [
      new DockerAnalyzer(),
      new DepsAnalyzer(),
      new CiAnalyzer()
    ];

    let baseline: any = {};
    const findings: any[] = [];
    let totalScore = 100;
    let totalSavings = { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 };

    for (const analyzer of analyzers) {
      if (await analyzer.isApplicable(projectPath)) {
        console.log(`Running ${analyzer.name} analysis...`);
        const result = await analyzer.analyze(projectPath);
        findings.push(...result.findings);
        baseline = { ...baseline, ...result.baseline };
        totalScore = Math.min(totalScore, result.score);
        totalSavings.timeSeconds += result.savings.timeSeconds;
        totalSavings.sizeMB += result.savings.sizeMB;
      }
    }

    const savedPath = await manager.save(baseline, findings, totalScore, totalSavings);
    console.log(`\n✅ Baseline saved to ${savedPath}`);
    console.log(`   Score: ${totalScore}/100`);
    console.log(`   Findings: ${findings.length}`);
    console.log(`   Savings: ${totalSavings.sizeMB} MB, ${Math.round(totalSavings.timeSeconds / 60)} min`);
    
    // Threshold alerts
    if (options['min-score'] && totalScore < options['min-score']) {
      console.log(`\n⚠️  Score ${totalScore} is below threshold ${options['min-score']}.`);
      if (options['fail-on-regression']) {
        console.log('Exiting with code 1.');
        process.exit(1);
      }
    }
    return;
  }

  // Compare with baseline
  if (options.compare) {
    console.log('Comparing with baseline...\n');

    // Collect current analysis
    const analyzers = [
      new DockerAnalyzer(),
      new DepsAnalyzer(),
      new CiAnalyzer()
    ];

    let baseline: any = {};
    const findings: any[] = [];
    let totalScore = 100;
    let totalSavings = { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 };

    for (const analyzer of analyzers) {
      if (await analyzer.isApplicable(projectPath)) {
        const result = await analyzer.analyze(projectPath);
        findings.push(...result.findings);
        baseline = { ...baseline, ...result.baseline };
        totalScore = Math.min(totalScore, result.score);
        totalSavings.timeSeconds += result.savings.timeSeconds;
        totalSavings.sizeMB += result.savings.sizeMB;
      }
    }

    const comparison = await manager.compare({
      baseline,
      findings,
      score: totalScore,
      savings: totalSavings
    });

    console.log(manager.formatComparison(comparison));
    
    // CI integration: fail on regression
    if (options['fail-on-regression'] && comparison.changes.scoreDelta < 0) {
      console.log('\n❌ Regression detected! Exiting with code 1.');
      process.exit(1);
    }
    
    // Threshold alerts
    if (options['min-score'] && comparison.current.score < options['min-score']) {
      console.log(`\n⚠️  Score ${comparison.current.score} is below threshold ${options['min-score']}. Exiting with code 1.`);
      process.exit(1);
    }
    
    if (comparison.changes.regressions.length > 0) {
      console.log('\n🔴 Regressions detected!');
      console.log('   Run `dev-optimizer fix --safe` to fix.');
    }
    return;
  }

  // Show history
  if (options.history) {
    console.log('Loading history...\n');

    const history = await manager.loadHistory();
    
    if (!history || history.records.length === 0) {
      console.log('No history found. Run `dev-optimizer baseline --save` first.');
      return;
    }

    console.log('📊 Baseline History\n');
    console.log('Date                    | Score | Findings | Savings');
    console.log('─'.repeat(60));

    for (const record of history.records.slice(-20)) {
      const date = record.timestamp.split('T')[0];
      const time = record.timestamp.split('T')[1].split('.')[0];
      const savings = `${record.savings.sizeMB} MB`;
      console.log(`${date} ${time} | ${record.score}/100 | ${record.findings.total}        | ${savings}`);
    }

    console.log(`\nTotal records: ${history.records.length}`);
    return;
  }

  // Default: show current baseline
  const current = await manager.load();
  
  if (!current) {
    console.log('No baseline found.');
    console.log('Run `dev-optimizer baseline --save` to create one.');
    return;
  }

  console.log('📊 Current Baseline\n');
  console.log(`Saved: ${current.timestamp}`);
  console.log(`Score: ${current.score}/100`);
  console.log(`Findings: ${current.findings.total}`);
  console.log(`\nBy Domain:`);
  for (const [domain, count] of Object.entries(current.findings.byDomain)) {
    console.log(`  ${domain}: ${count}`);
  }
  console.log(`\nBy Severity:`);
  for (const [severity, count] of Object.entries(current.findings.bySeverity)) {
    console.log(`  ${severity}: ${count}`);
  }
  console.log(`\nSavings:`);
  console.log(`  Size: ${current.savings.sizeMB} MB`);
  console.log(`  Time: ${Math.round(current.savings.timeSeconds / 60)} min`);
}
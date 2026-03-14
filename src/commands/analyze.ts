/**
 * Analyze command
 * Unified analysis with Finding schema
 */

import * as fs from 'fs';
import * as path from 'path';
import { DockerAnalyzer } from '../analyzers/DockerAnalyzer.js';
import { DepsAnalyzer } from '../analyzers/DepsAnalyzer.js';
import { CiAnalyzer } from '../analyzers/CiAnalyzer.js';
import { ConsoleReporter } from '../reporters/ConsoleReporter.js';
import { MarkdownReporter } from '../reporters/MarkdownReporter.js';
import { RepoScanner } from '../discovery/RepoInventory.js';
import { DeepAnalyzer } from '../deep-analyzer.js';
import { FullReport, Finding, Domain } from '../types.js';
import ora from 'ora';

interface AnalyzeOptions {
  path: string;
  output: 'table' | 'json' | 'markdown';
  type: 'docker' | 'deps' | 'ci' | 'all';
  top: number;
  quick?: boolean;
  deep?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const projectPath = path.resolve(options.path);
  
  // Verify path exists
  if (!fs.existsSync(projectPath)) {
    console.error(`Path not found: ${projectPath}`);
    process.exit(1);
  }

  // Spinner for UX
  const spinner = ora({ spinner: 'dots', color: 'cyan' });
  
  if (!options.quiet) {
    console.log(`🔍 Dev Optimizer v0.1.0\n`);
  }

  // Scan repository
  if (!options.quiet) {
    spinner.start('Scanning repository...');
  }
  const scanner = new RepoScanner();
  const inventory = await scanner.scan(projectPath);
  
  if (!options.quiet) {
    spinner.succeed('Repository scanned');
    console.log(scanner.printSummary(inventory));
    console.log('');
  }

  // Initialize analyzers - pass mode based on quick option
  const analyzerMode = options.quick ? 'quick' : 'full';
  const dockerAnalyzer = new DockerAnalyzer({ mode: analyzerMode });
  const depsAnalyzer = new DepsAnalyzer({ mode: analyzerMode });
  const ciAnalyzer = new CiAnalyzer();
  
  const allFindings: Finding[] = [];
  let baseline = inventory.baseline;
  let totalSavings = { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 };

  // Determine which domains to analyze
  const domains: Domain[] = options.type === 'all' 
    ? inventory.availableDomains
    : [options.type as Domain].filter(d => inventory.availableDomains.includes(d));

  // Warn about missing domains
  if (options.type !== 'all') {
    const requested = options.type as Domain;
    if (!inventory.availableDomains.includes(requested)) {
      console.log(`⚠️  Warning: ${requested} analysis requested but not available.`);
      console.log(`   Available domains: ${inventory.availableDomains.join(', ') || 'none'}\n`);
    }
  }

  // PARALLEL EXECUTION: Run all analyzers concurrently for maximum speed
  if (!options.quiet) {
    spinner.start('⚡ Running analyzers in parallel...');
  }

  // Check applicability in parallel
  const [dockerApply, depsApply, ciApply] = await Promise.all([
    domains.includes('docker') ? dockerAnalyzer.isApplicable(projectPath) : Promise.resolve(false),
    domains.includes('deps') ? depsAnalyzer.isApplicable(projectPath) : Promise.resolve(false),
    domains.includes('ci') ? ciAnalyzer.isApplicable(projectPath) : Promise.resolve(false)
  ]);

  // Run applicable analyzers in parallel
  const analysisPromises: Promise<any>[] = [];
  const applicabilityResults: boolean[] = [];

  if (dockerApply) {
    analysisPromises.push(dockerAnalyzer.analyze(projectPath));
    applicabilityResults.push(true);
  } else {
    analysisPromises.push(Promise.resolve(null));
    applicabilityResults.push(false);
  }

  if (depsApply) {
    analysisPromises.push(depsAnalyzer.analyze(projectPath));
    applicabilityResults.push(true);
  } else {
    analysisPromises.push(Promise.resolve(null));
    applicabilityResults.push(false);
  }

  if (ciApply) {
    analysisPromises.push(ciAnalyzer.analyze(projectPath));
    applicabilityResults.push(true);
  } else {
    analysisPromises.push(Promise.resolve(null));
    applicabilityResults.push(false);
  }

  const [dockerResult, depsResult, ciResult] = await Promise.all(analysisPromises);

  // Collect results
  if (dockerResult) {
    allFindings.push(...dockerResult.findings);
    baseline = { ...baseline, ...dockerResult.baseline };
    totalSavings.timeSeconds += dockerResult.savings.timeSeconds;
    totalSavings.sizeMB += dockerResult.savings.sizeMB;
  }
  if (depsResult) {
    allFindings.push(...depsResult.findings);
    baseline = { ...baseline, ...depsResult.baseline };
    totalSavings.timeSeconds += depsResult.savings.timeSeconds;
    totalSavings.sizeMB += depsResult.savings.sizeMB;
  }
  if (ciResult) {
    allFindings.push(...ciResult.findings);
    baseline = { ...baseline, ...ciResult.baseline };
    totalSavings.timeSeconds += ciResult.savings.timeSeconds;
  }

  // Show results
  if (!options.quiet) {
    spinner.succeed(`Analyzed ${allFindings.length} findings`);
    if (!dockerApply) spinner.info('🐳 Docker not applicable');
    if (!depsApply) spinner.info('📦 Dependencies not applicable');
    if (!ciApply) spinner.info('🔄 CI config not applicable');
  }

  // Deep analysis (optional)
  if (options.deep) {
    if (!options.quiet) {
      spinner.start('🔬 Running deep analysis...');
    }
    const deepAnalyzer = new DeepAnalyzer();
    
    // Size estimates
    const sizeRecommendations = await deepAnalyzer.getSizeRecommendations(projectPath);
    if (!options.quiet) {
      spinner.succeed(`Deep analysis: ${sizeRecommendations.length} recommendations`);
      if (sizeRecommendations.length > 0) {
        console.log('\n📊 Size Estimates:');
        for (const rec of sizeRecommendations) {
          console.log(`   ${rec.category}: ${rec.current} → ${rec.potential} (${rec.savings})`);
        }
      }
    }
    
    // Docker layers (if Dockerfile exists)
    const dockerFindings = await deepAnalyzer.analyzeDockerLayers(projectPath);
    allFindings.push(...dockerFindings);
    
    // CI speedup estimate
    const ciEstimate = await deepAnalyzer.estimateCiSpeedup(projectPath, allFindings);
    if (!options.quiet && ciEstimate.savings.includes('minutes')) {
      console.log(`\n⏱️  CI Optimization: ${ciEstimate.current}min → ${ciEstimate.potential}min (${ciEstimate.savings})`);
    }
  }

  if (!options.quiet) {
    console.log('');
  }

  if (allFindings.length === 0) {
    if (!options.quiet) {
      console.log('✅ No issues found!\n');
    }
    return;
  }

  // Sort findings by severity + confidence
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  
  allFindings.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
  });

  // Calculate overall score
  const score = calculateScore(allFindings);

  // Categorize findings
  const topFindings = allFindings.slice(0, options.top);
  const quickWins = allFindings.filter(f => f.suggestedFix.autoFixable && f.confidence === 'high');
  const manualReview = allFindings.filter(f => !f.autoFixSafe || f.confidence !== 'high');

  // Calculate percentage improvement
  if (baseline.nodeModulesSizeMB && totalSavings.sizeMB > 0) {
    totalSavings.percentImprovement = Math.round(
      (totalSavings.sizeMB / baseline.nodeModulesSizeMB) * 100
    );
  } else if (totalSavings.sizeMB > 0) {
    totalSavings.percentImprovement = Math.round(totalSavings.sizeMB / 10);
  }

  // Build report
  const report: FullReport = {
    timestamp: new Date().toISOString(),
    path: projectPath,
    version: '0.1.0',
    baseline,
    findings: allFindings,
    topFindings,
    quickWins,
    manualReview,
    totalSavings,
    score
  };

  // Output report
  console.log('\n' + '═'.repeat(60) + '\n');

  switch (options.output) {
    case 'json':
      console.log(JSON.stringify(report, null, 2));
      break;
    case 'markdown':
      const mdReporter = new MarkdownReporter();
      console.log(mdReporter.format(report));
      break;
    default:
      const reporter = new ConsoleReporter();
      console.log(reporter.format(report));
  }
}

function calculateScore(findings: Finding[]): number {
  let score = 100;
  
  // Group findings by ID to avoid double-counting same issue
  const seen = new Set<string>();
  
  for (const finding of findings) {
    // Skip duplicates
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    
    // Reduced penalties for better UX
    switch (finding.severity) {
      case 'critical': score -= 15; break;
      case 'high': score -= 10; break;
      case 'medium': score -= 5; break;
      case 'low': score -= 2; break;
    }
  }
  
  return Math.max(0, score);
}
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
export async function analyzeCommand(options) {
    const projectPath = path.resolve(options.path);
    // Verify path exists
    if (!fs.existsSync(projectPath)) {
        console.error(`Path not found: ${projectPath}`);
        process.exit(1);
    }
    console.log(`🔍 Dev Optimizer v0.1.0\n`);
    console.log(`Analyzing: ${projectPath}\n`);
    // Scan repository
    const scanner = new RepoScanner();
    const inventory = await scanner.scan(projectPath);
    // Print inventory summary
    console.log(scanner.printSummary(inventory));
    console.log('');
    // Initialize analyzers
    const dockerAnalyzer = new DockerAnalyzer();
    const depsAnalyzer = new DepsAnalyzer();
    const ciAnalyzer = new CiAnalyzer();
    const allFindings = [];
    let baseline = inventory.baseline;
    let totalSavings = { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 };
    // Determine which domains to analyze
    const domains = options.type === 'all'
        ? inventory.availableDomains
        : [options.type].filter(d => inventory.availableDomains.includes(d));
    // Warn about missing domains
    if (options.type !== 'all') {
        const requested = options.type;
        if (!inventory.availableDomains.includes(requested)) {
            console.log(`⚠️  Warning: ${requested} analysis requested but not available.`);
            console.log(`   Available domains: ${inventory.availableDomains.join(', ') || 'none'}\n`);
        }
    }
    // Run applicable analyzers
    // Docker analysis
    if (domains.includes('docker')) {
        if (await dockerAnalyzer.isApplicable(projectPath)) {
            console.log('🐳 Running Docker analysis...');
            const result = await dockerAnalyzer.analyze(projectPath);
            allFindings.push(...result.findings);
            baseline = { ...baseline, ...result.baseline };
            totalSavings.timeSeconds += result.savings.timeSeconds;
            totalSavings.sizeMB += result.savings.sizeMB;
        }
        else {
            console.log('⚠️  Dockerfile not applicable');
        }
    }
    // Dependencies analysis
    if (domains.includes('deps')) {
        if (await depsAnalyzer.isApplicable(projectPath)) {
            console.log('📦 Running Dependencies analysis...');
            const result = await depsAnalyzer.analyze(projectPath);
            allFindings.push(...result.findings);
            baseline = { ...baseline, ...result.baseline };
            totalSavings.timeSeconds += result.savings.timeSeconds;
            totalSavings.sizeMB += result.savings.sizeMB;
        }
        else {
            console.log('⚠️  package.json not applicable');
        }
    }
    // CI/CD analysis
    if (domains.includes('ci')) {
        if (await ciAnalyzer.isApplicable(projectPath)) {
            console.log('🔄 Running CI/CD analysis...');
            const result = await ciAnalyzer.analyze(projectPath);
            allFindings.push(...result.findings);
            baseline = { ...baseline, ...result.baseline };
            totalSavings.timeSeconds += result.savings.timeSeconds;
        }
        else {
            console.log('⚠️  CI config not applicable');
        }
    }
    if (allFindings.length === 0) {
        console.log('\n✅ No issues found!\n');
        return;
    }
    // Sort findings by severity + confidence
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    allFindings.sort((a, b) => {
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0)
            return severityDiff;
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
        totalSavings.percentImprovement = Math.round((totalSavings.sizeMB / baseline.nodeModulesSizeMB) * 100);
    }
    else if (totalSavings.sizeMB > 0) {
        totalSavings.percentImprovement = Math.round(totalSavings.sizeMB / 10);
    }
    // Build report
    const report = {
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
function calculateScore(findings) {
    let score = 100;
    for (const finding of findings) {
        switch (finding.severity) {
            case 'critical':
                score -= 30;
                break;
            case 'high':
                score -= 20;
                break;
            case 'medium':
                score -= 10;
                break;
            case 'low':
                score -= 5;
                break;
        }
    }
    return Math.max(0, score);
}
//# sourceMappingURL=analyze.js.map
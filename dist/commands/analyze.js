/**
 * Analyze command
 */
import * as fs from 'fs';
import * as path from 'path';
import { DockerAnalyzer } from '../analyzers/DockerAnalyzer.js';
import { NpmAnalyzer } from '../analyzers/NpmAnalyzer.js';
import { ConsoleReporter } from '../reporters/ConsoleReporter.js';
export async function analyzeCommand(options) {
    const projectPath = path.resolve(options.path);
    // Verify path exists
    if (!fs.existsSync(projectPath)) {
        console.error(`Path not found: ${projectPath}`);
        process.exit(1);
    }
    console.log(`Analyzing: ${projectPath}\n`);
    // Initialize analyzers
    const dockerAnalyzer = new DockerAnalyzer();
    const npmAnalyzer = new NpmAnalyzer();
    const report = {
        timestamp: new Date().toISOString(),
        path: projectPath,
        overallScore: 0,
        totalSavings: { sizeMB: 0, timeSeconds: 0, percentImprovement: 0 }
    };
    // Run applicable analyzers
    const results = [];
    // Docker analysis
    if (options.type === 'all' || options.type === 'docker') {
        if (await dockerAnalyzer.isApplicable(projectPath)) {
            console.log('Running Docker analysis...');
            const dockerResult = await dockerAnalyzer.analyze(projectPath);
            report.docker = dockerResult;
            results.push(dockerResult);
        }
        else {
            console.log('No Dockerfile found, skipping Docker analysis.');
        }
    }
    // npm analysis
    if (options.type === 'all' || options.type === 'npm') {
        if (await npmAnalyzer.isApplicable(projectPath)) {
            console.log('Running npm analysis...');
            const npmResult = await npmAnalyzer.analyze(projectPath);
            report.npm = npmResult;
            results.push(npmResult);
        }
        else {
            console.log('No package.json found, skipping npm analysis.');
        }
    }
    // Calculate overall score
    if (results.length > 0) {
        report.overallScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
        report.totalSavings = {
            sizeMB: results.reduce((sum, r) => sum + r.savings.sizeMB, 0),
            timeSeconds: results.reduce((sum, r) => sum + r.savings.timeSeconds, 0),
            percentImprovement: Math.round(results.reduce((sum, r) => sum + r.savings.percentImprovement, 0) / results.length)
        };
    }
    // Output report
    const reporter = new ConsoleReporter();
    const output = reporter.format(report);
    switch (options.output) {
        case 'json':
            console.log(JSON.stringify(report, null, 2));
            break;
        case 'markdown':
            console.log('```markdown');
            console.log(output);
            console.log('```');
            break;
        default:
            console.log(output);
    }
}
//# sourceMappingURL=analyze.js.map
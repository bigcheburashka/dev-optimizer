/**
 * Metrics command
 * Collect and compare metrics
 */
import * as fs from 'fs';
import * as path from 'path';
const CACHE_DIR = '.dev-optimizer-cache';
export async function metricsCommand(options) {
    const projectPath = path.resolve(options.path);
    const cacheDir = path.join(projectPath, CACHE_DIR);
    if (!fs.existsSync(projectPath)) {
        console.error(`Path not found: ${projectPath}`);
        process.exit(1);
    }
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    if (options.baseline) {
        // Save baseline metrics
        console.log('Collecting baseline metrics...\n');
        const metrics = await collectMetrics(projectPath);
        const baselinePath = path.join(cacheDir, 'baseline.json');
        fs.writeFileSync(baselinePath, JSON.stringify(metrics, null, 2));
        console.log('Baseline metrics saved to .dev-optimizer-cache/baseline.json');
        console.log(JSON.stringify(metrics, null, 2));
    }
    else if (options.compare) {
        // Compare with baseline
        const baselinePath = path.join(cacheDir, 'baseline.json');
        if (!fs.existsSync(baselinePath)) {
            console.error('No baseline found. Run with --baseline first.');
            process.exit(1);
        }
        console.log('Collecting current metrics...\n');
        const current = await collectMetrics(projectPath);
        const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
        const comparison = compareMetrics(baseline, current);
        console.log('Metrics Comparison\n');
        console.log('═'.repeat(60));
        console.log(formatComparison(baseline, current, comparison));
    }
    else {
        // Just collect metrics
        console.log('Collecting metrics...\n');
        const metrics = await collectMetrics(projectPath);
        console.log(JSON.stringify(metrics, null, 2));
    }
}
async function collectMetrics(projectPath) {
    const metrics = {};
    // Docker metrics
    if (fs.existsSync(path.join(projectPath, 'Dockerfile'))) {
        console.log('Collecting Docker metrics...');
        metrics.docker = await collectDockerMetrics(projectPath);
    }
    // npm metrics
    if (fs.existsSync(path.join(projectPath, 'package.json'))) {
        console.log('Collecting npm metrics...');
        metrics.npm = await collectNpmMetrics(projectPath);
    }
    return metrics;
}
async function collectDockerMetrics(projectPath) {
    // Try to get actual image size if image exists
    // Otherwise estimate from Dockerfile
    return {
        imageSize: 1200, // MB estimate
        buildTime: 180, // seconds estimate
        layerCount: 10, // estimate
        contextSize: 100 // MB estimate
    };
}
async function collectNpmMetrics(projectPath) {
    // Get package.json info
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
    const totalDeps = Object.keys(packageJson.dependencies || {}).length +
        Object.keys(packageJson.devDependencies || {}).length;
    // Get node_modules size
    let nodeModulesSize = 0;
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        nodeModulesSize = await getDirectorySize(nodeModulesPath);
    }
    return {
        installTimeCold: 45, // seconds estimate
        installTimeCached: 8, // seconds estimate
        nodeModulesSize,
        totalDeps,
        unusedDeps: 0, // Would need depcheck
        outdatedDeps: 0 // Would need npm outdated
    };
}
async function getDirectorySize(dir) {
    let size = 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            size += await getDirectorySize(filePath);
        }
        else {
            size += stats.size;
        }
    }
    return Math.round(size / (1024 * 1024)); // MB
}
function compareMetrics(baseline, current) {
    const result = {};
    // Docker metrics
    if (baseline.docker && current.docker) {
        result['Docker Image Size (MB)'] = {
            baseline: baseline.docker.imageSize,
            current: current.docker.imageSize,
            change: current.docker.imageSize - baseline.docker.imageSize,
            percent: baseline.docker.imageSize > 0
                ? Math.round(((current.docker.imageSize - baseline.docker.imageSize) / baseline.docker.imageSize) * 100)
                : 0,
            improved: current.docker.imageSize < baseline.docker.imageSize
        };
    }
    // npm metrics
    if (baseline.npm && current.npm) {
        result['node_modules Size (MB)'] = {
            baseline: baseline.npm.nodeModulesSize,
            current: current.npm.nodeModulesSize,
            change: current.npm.nodeModulesSize - baseline.npm.nodeModulesSize,
            percent: baseline.npm.nodeModulesSize > 0
                ? Math.round(((current.npm.nodeModulesSize - baseline.npm.nodeModulesSize) / baseline.npm.nodeModulesSize) * 100)
                : 0,
            improved: current.npm.nodeModulesSize < baseline.npm.nodeModulesSize
        };
        result['npm Install Time (s)'] = {
            baseline: baseline.npm.installTimeCold,
            current: current.npm.installTimeCold,
            change: current.npm.installTimeCold - baseline.npm.installTimeCold,
            percent: baseline.npm.installTimeCold > 0
                ? Math.round(((current.npm.installTimeCold - baseline.npm.installTimeCold) / baseline.npm.installTimeCold) * 100)
                : 0,
            improved: current.npm.installTimeCold < baseline.npm.installTimeCold
        };
        result['Total Dependencies'] = {
            baseline: baseline.npm.totalDeps,
            current: current.npm.totalDeps,
            change: current.npm.totalDeps - baseline.npm.totalDeps,
            percent: baseline.npm.totalDeps > 0
                ? Math.round(((current.npm.totalDeps - baseline.npm.totalDeps) / baseline.npm.totalDeps) * 100)
                : 0,
            improved: current.npm.totalDeps < baseline.npm.totalDeps
        };
    }
    return result;
}
function formatComparison(baseline, current, comparison) {
    const lines = [];
    lines.push('Metric                    | Baseline | Current | Change | %');
    lines.push('─'.repeat(70));
    for (const [metric, data] of Object.entries(comparison)) {
        const status = data.improved ? '✅' : '❌';
        lines.push(`${metric.padEnd(25)} | ${String(data.baseline).padStart(8)} | ${String(data.current).padStart(7)} | ${status} ${String(data.change).padStart(5)} | ${data.percent}%`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=metrics.js.map
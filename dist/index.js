/**
 * dev-optimizer CLI entry point
 */
import { program } from 'commander';
import { analyzeCommand } from './commands/analyze.js';
import { fixCommand } from './commands/fix.js';
import { metricsCommand } from './commands/metrics.js';
import { baselineCommand } from './commands/baseline.js';
const VERSION = '0.1.0';
program
    .name('dev-optimizer')
    .description('Optimize Docker images, npm packages, and CI/CD pipelines')
    .version(VERSION);
program
    .command('analyze')
    .description('Analyze project for optimization opportunities')
    .option('-p, --path <path>', 'Path to project', '.')
    .option('-o, --output <format>', 'Output format: console, json, markdown', 'console')
    .option('-t, --type <type>', 'Analysis type: docker, npm, ci, all', 'all')
    .option('--top <n>', 'Show top N findings', '5')
    .action(analyzeCommand);
program
    .command('fix')
    .description('Apply safe optimizations automatically')
    .option('-p, --path <path>', 'Path to project', '.')
    .option('--dry-run', 'Show changes without applying', false)
    .option('--safe', 'Only apply safe fixes', true)
    .action(fixCommand);
program
    .command('metrics')
    .description('Collect and compare metrics')
    .option('-p, --path <path>', 'Path to project', '.')
    .option('--save', 'Save as baseline', false)
    .option('--compare', 'Compare with baseline', false)
    .action(metricsCommand);
program
    .command('baseline')
    .description('Manage baseline metrics for regression tracking')
    .option('-p, --path <path>', 'Path to project', '.')
    .option('--save', 'Save current analysis as baseline', false)
    .option('--compare', 'Compare with previous baseline', false)
    .option('--history', 'Show baseline history', false)
    .action(baselineCommand);
program.parse();
//# sourceMappingURL=index.js.map
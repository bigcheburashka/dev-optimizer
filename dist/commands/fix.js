/**
 * Fix command
 * Apply safe optimizations automatically
 */
import * as fs from 'fs';
import * as path from 'path';
import { DockerAnalyzer } from '../analyzers/DockerAnalyzer.js';
import { DepsAnalyzer } from '../analyzers/DepsAnalyzer.js';
import { CiAnalyzer } from '../analyzers/CiAnalyzer.js';
export async function fixCommand(options) {
    const projectPath = path.resolve(options.path);
    if (!fs.existsSync(projectPath)) {
        console.error(`Path not found: ${projectPath}`);
        process.exit(1);
    }
    console.log(`Analyzing: ${projectPath}\n`);
    console.log(`Mode: ${options.dryRun ? 'dry-run (no changes)' : 'apply fixes'}\n`);
    console.log(`Safety: ${options.safe !== false ? 'safe fixes only' : 'all fixes'}\n`);
    const results = [];
    // Run analyzers and collect auto-fixable findings
    const dockerAnalyzer = new DockerAnalyzer();
    const depsAnalyzer = new DepsAnalyzer();
    const ciAnalyzer = new CiAnalyzer();
    const analyzers = [dockerAnalyzer, depsAnalyzer, ciAnalyzer];
    const allFindings = [];
    for (const analyzer of analyzers) {
        if (await analyzer.isApplicable(projectPath)) {
            console.log(`Running ${analyzer.name} analysis...`);
            const result = await analyzer.analyze(projectPath);
            allFindings.push(...result.findings);
        }
    }
    // Filter auto-fixable findings
    const autoFixable = allFindings.filter(f => f.autoFixSafe && f.suggestedFix.autoFixable);
    console.log(`Found ${autoFixable.length} auto-fixable issues\n`);
    for (const finding of autoFixable) {
        if (options.safe && !finding.autoFixSafe) {
            console.log(`Skipping (unsafe): ${finding.title}`);
            continue;
        }
        const result = await applyFix(projectPath, finding, options.dryRun);
        results.push(result);
        if (result.applied) {
            console.log(`✅ Applied: ${finding.title}`);
        }
        else if (options.dryRun) {
            console.log(`📝 Would apply: ${finding.title}`);
            if (finding.suggestedFix.diff) {
                console.log(`\n${finding.suggestedFix.diff}\n`);
            }
        }
    }
    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log(`Total findings: ${allFindings.length}`);
    console.log(`Auto-fixable: ${autoFixable.length}`);
    console.log(`Applied: ${results.filter(r => r.applied).length}`);
    console.log(`Skipped: ${results.filter(r => !r.applied).length}`);
    if (options.dryRun) {
        console.log('\nThis was a dry-run. No changes were made.');
        console.log('Run without --dry-run to apply changes.');
    }
}
async function applyFix(projectPath, finding, dryRun) {
    const fix = finding.suggestedFix;
    const filePath = path.join(projectPath, fix.file);
    try {
        // Create file
        if (fix.type === 'create') {
            if (fs.existsSync(filePath) && !dryRun) {
                return {
                    findingId: finding.id,
                    applied: false,
                    file: fix.file,
                    error: 'File already exists'
                };
            }
            if (!dryRun && fix.diff) {
                fs.writeFileSync(filePath, fix.diff);
            }
            return {
                findingId: finding.id,
                applied: !dryRun,
                file: fix.file,
                diff: fix.diff
            };
        }
        // Modify file (requires manual review in most cases)
        if (fix.type === 'modify') {
            // For now, just return the diff for review
            return {
                findingId: finding.id,
                applied: false,
                file: fix.file,
                diff: fix.diff
            };
        }
        // Delete file (rare, requires manual review)
        return {
            findingId: finding.id,
            applied: false,
            file: fix.file
        };
    }
    catch (error) {
        return {
            findingId: finding.id,
            applied: false,
            file: fix.file,
            error: String(error)
        };
    }
}
//# sourceMappingURL=fix.js.map
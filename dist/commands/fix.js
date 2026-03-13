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
    console.log(`🔧 Dev Optimizer Fix\n`);
    console.log(`Path: ${projectPath}`);
    console.log(`Mode: ${options.dryRun ? 'dry-run (preview only)' : 'apply changes'}`);
    console.log(`Safety: ${options.safe ? 'safe fixes only' : 'all auto-fixable'}\n`);
    // Collect findings from all analyzers
    const allFindings = [];
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
    const autoFixable = allFindings.filter(f => f.suggestedFix.autoFixable);
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
    // Show what will be fixed
    console.log('═'.repeat(60));
    console.log('Planned fixes:\n');
    for (const finding of toFix) {
        const icon = { docker: '🐳', deps: '📦', ci: '🔄' }[finding.domain];
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
    // Apply fixes
    const applied = [];
    const skipped = [];
    const errors = [];
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
        }
        else if (result.error) {
            errors.push({ finding, error: result.error });
            console.log(`❌ ${finding.title}: ${result.error}`);
        }
        else {
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
    // Next steps
    const remaining = allFindings.filter(f => !f.suggestedFix.autoFixable);
    if (remaining.length > 0) {
        console.log(`\n💡 ${remaining.length} issues require manual review.`);
        console.log('   Run `dev-optimizer analyze` to see details.\n');
    }
}
/**
 * Apply a single fix
 */
async function applyFix(projectPath, finding) {
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
    }
    catch (error) {
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
async function createFile(filePath, fix, finding) {
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
async function modifyFile(filePath, fix, finding) {
    if (!fs.existsSync(filePath)) {
        return {
            findingId: finding.id,
            applied: false,
            file: fix.file,
            error: 'File not found'
        };
    }
    // For now, modifications require manual review
    // Return the diff for user to apply manually
    return {
        findingId: finding.id,
        applied: false,
        file: fix.file,
        diff: fix.diff
    };
}
/**
 * Delete a file
 */
async function deleteFile(filePath, fix, finding) {
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
//# sourceMappingURL=fix.js.map
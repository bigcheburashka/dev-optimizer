/**
 * Fix command
 * Apply safe optimizations automatically
 */
import * as fs from 'fs';
import * as path from 'path';
import { DockerAnalyzer } from '../analyzers/DockerAnalyzer.js';
import { NpmAnalyzer } from '../analyzers/NpmAnalyzer.js';
export async function fixCommand(options) {
    const projectPath = path.resolve(options.path);
    if (!fs.existsSync(projectPath)) {
        console.error(`Path not found: ${projectPath}`);
        process.exit(1);
    }
    console.log(`Analyzing: ${projectPath}\n`);
    console.log(`Mode: ${options.dryRun ? 'dry-run (no changes)' : 'apply fixes'}\n`);
    console.log(`Safety: ${options.safe ? 'safe fixes only' : 'all fixes'}\n`);
    const actions = [];
    // Docker fixes
    const dockerAnalyzer = new DockerAnalyzer();
    if (await dockerAnalyzer.isApplicable(projectPath)) {
        const result = await dockerAnalyzer.analyze(projectPath);
        for (const suggestion of result.suggestions) {
            if (options.safe && !suggestion.safe) {
                console.log(`Skipping (unsafe): ${suggestion.description}`);
                continue;
            }
            if (suggestion.autoFix) {
                const action = await applyDockerFix(projectPath, suggestion.type, options.dryRun);
                if (action) {
                    actions.push(action);
                }
            }
        }
    }
    // npm fixes
    const npmAnalyzer = new NpmAnalyzer();
    if (await npmAnalyzer.isApplicable(projectPath)) {
        const result = await npmAnalyzer.analyze(projectPath);
        for (const suggestion of result.suggestions) {
            if (options.safe && !suggestion.safe) {
                console.log(`Skipping (unsafe): ${suggestion.description}`);
                continue;
            }
            if (suggestion.autoFix) {
                const action = await applyNpmFix(projectPath, suggestion.type, options.dryRun);
                if (action) {
                    actions.push(action);
                }
            }
        }
    }
    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log(`Total actions: ${actions.length}`);
    console.log(`Applied: ${actions.filter(a => a.applied).length}`);
    console.log(`Skipped: ${actions.filter(a => !a.applied).length}`);
    if (options.dryRun) {
        console.log('\nThis was a dry-run. No changes were made.');
        console.log('Run without --dry-run to apply changes.');
    }
}
async function applyDockerFix(projectPath, fixType, dryRun) {
    if (fixType === 'create_dockerignore') {
        const dockerignorePath = path.join(projectPath, '.dockerignore');
        if (fs.existsSync(dockerignorePath)) {
            return null; // Already exists
        }
        const content = `# Dependencies
node_modules
npm-debug.log
yarn-error.log
yarn.lock
package-lock.json

# Build outputs
dist
build
.next
out

# Development
.git
.gitignore
.vscode
.idea

# Environment
.env
.env.local
.env.*.local

# Tests
coverage
.nyc_output
*.test.js
*.spec.js

# Misc
*.log
*.tmp
.DS_Store
Thumbs.db
`;
        if (!dryRun) {
            fs.writeFileSync(dockerignorePath, content);
        }
        return {
            type: 'create_dockerignore',
            file: dockerignorePath,
            description: 'Created .dockerignore with common patterns',
            safe: true,
            applied: !dryRun
        };
    }
    return null;
}
async function applyNpmFix(projectPath, fixType, dryRun) {
    if (fixType === 'remove_unused_deps') {
        // Would run npx depcheck and remove unused deps
        // This is a simplified version
        return {
            type: 'remove_unused_deps',
            file: path.join(projectPath, 'package.json'),
            description: 'Remove unused dependencies (requires review)',
            safe: false, // Should be reviewed before applying
            applied: false
        };
    }
    return null;
}
//# sourceMappingURL=fix.js.map
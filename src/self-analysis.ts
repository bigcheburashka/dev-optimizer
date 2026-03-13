/**
 * Self-analysis module
 * Analyzes the package itself for issues
 */

import * as path from 'path';
import * as fs from 'fs';
import { Analyzer, Finding, AnalysisResult, Domain, Baseline, Savings } from './types.js';

export class SelfAnalyzer implements Analyzer {
  name: Domain = 'deps';

  async analyze(projectPath: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const packageJson = this.readPackageJson(projectPath);

    if (!packageJson) {
      return {
        analyzer: 'deps',
        score: 100,
        findings,
        baseline: {
          projectType: 'unknown',
          hasPackageJson: false,
          hasDockerfile: false,
          hasCi: false,
          dependencyCount: 0
        },
        savings: { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 }
      };
    }

    // Check for unused dependencies
    const unusedDeps = await this.findUnusedDependencies(projectPath, packageJson);
    if (unusedDeps.length > 0) {
      findings.push({
        id: 'self-unused-deps',
        domain: 'deps',
        title: `Unused dependencies: ${unusedDeps.join(', ')}`,
        description: 'These dependencies are declared in package.json but not imported anywhere.',
        evidence: { file: 'package.json' },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'maintenance',
          estimate: `Reduce bundle by ~${unusedDeps.length * 100}KB`,
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: `Remove unused dependencies: ${unusedDeps.join(', ')}`,
          autoFixable: true
        },
        autoFixSafe: true
      });
    }

    // Check for missing test coverage
    const filesWithoutTests = this.findFilesWithoutTests(projectPath);
    if (filesWithoutTests.length > 0) {
      findings.push({
        id: 'self-missing-tests',
        domain: 'deps',
        title: `Files without tests: ${filesWithoutTests.length}`,
        description: 'These source files have no corresponding test files.',
        evidence: { file: filesWithoutTests[0] },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'maintenance',
          estimate: 'Improve code quality',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'create',
          file: 'tests/',
          description: 'Add test files for: ' + filesWithoutTests.slice(0, 3).join(', '),
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Check for missing package.json fields
    const missingFields = this.findMissingPackageFields(packageJson);
    if (missingFields.length > 0) {
      findings.push({
        id: 'self-missing-fields',
        domain: 'deps',
        title: `Missing package.json fields: ${missingFields.join(', ')}`,
        description: 'Package.json is missing important fields for public distribution.',
        evidence: { file: 'package.json' },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'maintenance',
          estimate: 'Improve npm discoverability',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: 'Add missing fields: ' + missingFields.join(', '),
          autoFixable: true
        },
        autoFixSafe: true
      });
    }

    return {
      analyzer: 'deps',
      score: 85,
      findings,
      baseline: {
        projectType: 'library',
        hasPackageJson: true,
        hasDockerfile: false,
        hasCi: false,
        dependencyCount: Object.keys(packageJson.dependencies || {}).length
      },
      savings: {
        timeSeconds: 0,
        sizeMB: unusedDeps.length * 0.1,
        percentImprovement: 0
      }
    };
  }

  isApplicable(projectPath: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  private readPackageJson(projectPath: string): any {
    try {
      const pkgPath = path.join(projectPath, 'package.json');
      const content = fs.readFileSync(pkgPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async findUnusedDependencies(projectPath: string, pkg: any): Promise<string[]> {
    const unused: string[] = [];
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const dep of Object.keys(deps)) {
      // Skip built-ins and specific packages
      if (dep.startsWith('@types/') || dep === 'typescript' || dep === 'jest' || dep === 'vitest') {
        continue;
      }

      const srcPath = path.join(projectPath, 'src');
      if (!fs.existsSync(srcPath)) continue;

      const found = await this.searchInDir(srcPath, dep);
      if (!found) {
        unused.push(dep);
      }
    }

    return unused;
  }

  private async searchInDir(dir: string, dep: string): Promise<boolean> {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      if (file.isDirectory()) {
        const found = await this.searchInDir(fullPath, dep);
        if (found) return true;
      } else if (file.name.endsWith('.ts') || file.name.endsWith('.js')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.includes(`from '${dep}'`) || content.includes(`"${dep}"`)) {
            return true;
          }
        } catch {
          continue;
        }
      }
    }

    return false;
  }

  private findFilesWithoutTests(projectPath: string): string[] {
    const srcPath = path.join(projectPath, 'src');
    const testsPath = path.join(projectPath, 'tests');

    if (!fs.existsSync(srcPath)) return [];

    const srcFiles = this.collectTsFiles(srcPath);
    const testFiles = fs.existsSync(testsPath)
      ? this.collectTsFiles(testsPath)
      : [];

    const testBasenames = new Set(testFiles.map(f => f.replace('.test.ts', '').replace('.spec.ts', '')));

    return srcFiles.filter(f => {
      const basename = f.replace('.ts', '');
      return !testBasenames.has(basename) && !f.endsWith('.d.ts');
    });
  }

  private collectTsFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.collectTsFiles(fullPath));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(entry.name);
      }
    }

    return files;
  }

  private findMissingPackageFields(pkg: any): string[] {
    const missing: string[] = [];
    const requiredFields = ['name', 'version', 'description', 'main', 'license', 'repository'];

    for (const field of requiredFields) {
      if (!pkg[field]) {
        missing.push(field);
      }
    }

    return missing;
  }
}
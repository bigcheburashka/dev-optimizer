/**
 * Dependency Analyzer
 * Analyzes package.json for optimization opportunities
 * Returns unified Finding[] format
 */

import * as fs from 'fs';
import * as path from 'path';
import { Analyzer, AnalysisResult, Finding, Baseline, Savings, Domain } from '../types.js';

export class DepsAnalyzer implements Analyzer {
  name: Domain = 'deps';

  async isApplicable(projectPath: string): Promise<boolean> {
    return fs.existsSync(path.join(projectPath, 'package.json'));
  }

  async analyze(projectPath: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const baseline = await this.collectBaseline(projectPath);

    // Parse package.json
    const packageJson = await this.readPackageJson(projectPath);
    const packageLockExists = fs.existsSync(path.join(projectPath, 'package-lock.json'));

    // Finding: Unused dependencies
    const unusedDeps = await this.findUnusedDeps(projectPath);
    for (const dep of unusedDeps.slice(0, 10)) { // Limit to 10 findings
      findings.push({
        id: `deps-001-${dep.name}`,
        domain: 'deps',
        title: `Unused dependency: ${dep.name}`,
        description: `Package '${dep.name}' is in dependencies but never imported.`,
        evidence: {
          file: 'package.json',
          snippet: `"${dep.name}": "${dep.version}"`,
          metrics: {
            packageSizeKB: dep.size,
            importCount: 0
          }
        },
        severity: 'medium',
        confidence: dep.confidence,
        impact: {
          type: 'size',
          estimate: `Save ${dep.size} KB in node_modules`,
          confidence: dep.confidence
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: `Remove ${dep.name} from dependencies`,
          diff: `-    "${dep.name}": "${dep.version}",`,
          autoFixable: dep.confidence === 'high'
        },
        autoFixSafe: dep.confidence === 'high'
      });
    }

    // Finding: Duplicate dependencies
    const duplicates = await this.findDuplicates(projectPath);
    for (const dup of duplicates) {
      findings.push({
        id: `deps-002-${dup.name}`,
        domain: 'deps',
        title: `Duplicate dependency: ${dup.name}`,
        description: `Multiple versions of '${dup.name}' detected: ${dup.versions.join(', ')}.`,
        evidence: {
          file: 'package-lock.json',
          metrics: {
            versionCount: dup.versions.length,
            extraSizeKB: dup.extraSize
          }
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: `Save ${dup.extraSize} KB by deduplicating`,
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: 'Run npm dedupe or fix version constraints',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Missing package-lock.json
    if (!packageLockExists) {
      findings.push({
        id: 'deps-003-lockfile',
        domain: 'deps',
        title: 'Missing package-lock.json',
        description: 'No lockfile found. This can lead to inconsistent installs across environments.',
        evidence: {},
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'Inconsistent install times across environments',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'create',
          file: 'package-lock.json',
          description: 'Run npm install to generate lockfile',
          autoFixable: true
        },
        autoFixSafe: true
      });
    }

    // Finding: Large packages (heuristic)
    const largePackages = await this.findLargePackages(projectPath);
    for (const pkg of largePackages) {
      findings.push({
        id: `deps-004-${pkg.name}`,
        domain: 'deps',
        title: `Large package: ${pkg.name} (${pkg.size} KB)`,
        description: `Package '${pkg.name}' is large. Consider alternatives: ${pkg.alternatives.join(', ')}.`,
        evidence: {
          metrics: {
            packageSizeKB: pkg.size
          }
        },
        severity: 'low',
        confidence: 'low',
        impact: {
          type: 'size',
          estimate: `Consider smaller alternatives`,
          confidence: 'low'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: `Consider replacing ${pkg.name} with a smaller alternative`,
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Prod vs Dev classification (heuristic)
    const misclassified = this.findMisclassified(packageJson);
    for (const pkg of misclassified) {
      findings.push({
        id: `deps-005-${pkg.name}`,
        domain: 'deps',
        title: `Misclassified dependency: ${pkg.name}`,
        description: `Package '${pkg.name}' appears to be ${pkg.suggestedType} but is in ${pkg.currentType}.`,
        evidence: {
          file: 'package.json',
          snippet: `"${pkg.name}": "${pkg.version}"`
        },
        severity: 'medium',
        confidence: 'medium',
        impact: {
          type: 'size',
          estimate: 'Reduce production bundle size',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: `Move ${pkg.name} to ${pkg.suggestedType}`,
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    const savings = this.calculateSavings(findings, baseline);

    return {
      analyzer: 'deps',
      score: this.calculateScore(findings),
      findings,
      baseline,
      savings
    };
  }

  private async collectBaseline(projectPath: string): Promise<Baseline> {
    const packageJson = await this.readPackageJson(projectPath);
    const deps = Object.keys(packageJson.dependencies || {}).length;
    const devDeps = Object.keys(packageJson.devDependencies || {}).length;

    let nodeModulesSize = 0;
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      nodeModulesSize = await this.getDirectorySize(nodeModulesPath);
    }

    return {
      projectType: 'npm',
      hasPackageJson: true,
      hasDockerfile: fs.existsSync(path.join(projectPath, 'Dockerfile')),
      hasCi: fs.existsSync(path.join(projectPath, '.github/workflows')) ||
             fs.existsSync(path.join(projectPath, '.gitlab-ci.yml')),
      dependencyCount: deps + devDeps,
      nodeModulesSizeMB: nodeModulesSize
    };
  }

  private calculateScore(findings: Finding[]): number {
    let score = 100;

    for (const finding of findings) {
      switch (finding.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }

    return Math.max(0, score);
  }

  private calculateSavings(findings: Finding[], baseline: Baseline): Savings {
    let sizeKB = 0;

    for (const finding of findings) {
      if (finding.impact.type === 'size' && finding.evidence.metrics?.packageSizeKB) {
        sizeKB += finding.evidence.metrics.packageSizeKB;
      }
    }

    return {
      timeSeconds: 0,
      sizeMB: Math.round(sizeKB / 1024),
      percentImprovement: baseline.nodeModulesSizeMB ? 
        Math.round((sizeKB / 1024) / baseline.nodeModulesSizeMB * 100) : 0
    };
  }

  private async readPackageJson(projectPath: string): Promise<any> {
    const content = fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8');
    return JSON.parse(content);
  }

  private async getDirectorySize(dir: string): Promise<number> {
    let size = 0;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        size += await this.getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    }
    
    return Math.round(size / (1024 * 1024)); // MB
  }

  private async findUnusedDeps(projectPath: string): Promise<{ name: string; version: string; size: number; confidence: 'high' | 'medium' | 'low' }[]> {
    // This would integrate with depcheck or knip
    // Simplified implementation
    return [];
  }

  private async findDuplicates(projectPath: string): Promise<{ name: string; versions: string[]; extraSize: number }[]> {
    // Simplified implementation
    return [];
  }

  private async findLargePackages(projectPath: string): Promise<{ name: string; size: number; alternatives: string[] }[]> {
    const largePackages: Record<string, { alternatives: string[] }> = {
      'moment': { alternatives: ['date-fns', 'dayjs'] },
      'lodash': { alternatives: ['lodash-es', 'native methods'] },
      '@babel/core': { alternatives: ['swc', 'esbuild'] }
    };

    // Simplified - would check actual sizes
    return [];
  }

  private findMisclassified(packageJson: any): { name: string; version: string; currentType: string; suggestedType: string }[] {
    // Simplified - would check import patterns
    return [];
  }
}
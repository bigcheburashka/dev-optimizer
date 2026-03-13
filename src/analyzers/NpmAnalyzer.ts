/**
 * npm Analyzer
 * Analyzes package.json for optimization opportunities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { Analyzer, AnalysisResult, Issue, NpmMetrics, Savings, Suggestion } from '../types.js';

export class NpmAnalyzer implements Analyzer {
  name = 'npm';

  async isApplicable(projectPath: string): Promise<boolean> {
    return fs.existsSync(path.join(projectPath, 'package.json'));
  }

  async analyze(projectPath: string): Promise<AnalysisResult> {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];
    let score = 100;

    // Parse package.json
    const packageJson = await this.readPackageJson(projectPath);
    const packageLockExists = fs.existsSync(path.join(projectPath, 'package-lock.json'));

    // Get dependency counts
    const metrics = await this.collectMetrics(projectPath, packageJson);

    // Check for unused dependencies
    if (metrics.unusedDeps > 0) {
      issues.push({
        type: 'unused_dependencies',
        severity: 'medium',
        message: `Found ${metrics.unusedDeps} unused dependencies`,
        suggestion: 'Remove unused dependencies with npm prune or manually'
      });
      score -= Math.min(20, metrics.unusedDeps * 3);
      suggestions.push({
        type: 'remove_unuseddeps',
        description: `Remove ${metrics.unusedDeps} unused dependencies`,
        impact: `Save ${metrics.unusedDeps * 5} MB`,
        autoFix: true,
        safe: true
      });
    }

    // Check for outdated dependencies
    if (metrics.outdatedDeps > 0) {
      issues.push({
        type: 'outdated_dependencies',
        severity: 'low',
        message: `Found ${metrics.outdatedDeps} outdated dependencies`,
        suggestion: 'Run npm update to update dependencies'
      });
      score -= Math.min(10, metrics.outdatedDeps * 2);
    }

    // Check for duplicates
    const duplicates = await this.findDuplicates(projectPath);
    if (duplicates.length > 0) {
      issues.push({
        type: 'duplicate_dependencies',
        severity: 'medium',
        message: `Found ${duplicates.length} duplicate dependencies`,
        suggestion: 'Deduplicate with npm dedupe'
      });
      score -= duplicates.length * 5;
    }

    // Check package-lock.json
    if (!packageLockExists) {
      issues.push({
        type: 'missing_package_lock',
        severity: 'medium',
        message: 'Missing package-lock.json',
        suggestion: 'Run npm install to generate package-lock.json'
      });
      score -= 10;
    }

    // Check for large packages
    const largePackages = await this.findLargePackages(projectPath);
    for (const pkg of largePackages.slice(0, 5)) {
      if (pkg.sizeMB > 5) {
        issues.push({
          type: 'large_package',
          severity: 'low',
          message: `Large package: ${pkg.name} (${pkg.sizeMB} MB)`,
          suggestion: `Consider alternatives: ${pkg.alternatives.join(', ')}`
        });
      }
    }

    // Check devDependencies vs dependencies
    const depsCount = Object.keys(packageJson.dependencies || {}).length;
    const devDepsCount = Object.keys(packageJson.devDependencies || {}).length;
    
    if (devDepsCount > depsCount * 2) {
      issues.push({
        type: 'too_many_dev_deps',
        severity: 'low',
        message: `More devDependencies (${devDepsCount}) than dependencies (${depsCount})`,
        suggestion: 'Review if all devDependencies are needed'
      });
    }

    // Calculate savings
    const savingsMB = metrics.unusedDeps * 5 + duplicates.length * 2;
    const savings: Savings = {
      sizeMB: savingsMB,
      timeSeconds: Math.round(metrics.unusedDeps * 2),
      percentImprovement: metrics.nodeModulesSize > 0 ? Math.round((savingsMB / metrics.nodeModulesSize) * 100) : 0
    };

    return {
      analyzer: 'npm',
      score: Math.max(0, score),
      issues,
      suggestions,
      metrics: { npm: metrics },
      savings
    };
  }

  private async readPackageJson(projectPath: string): Promise<any> {
    const content = fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8');
    return JSON.parse(content);
  }

  private async collectMetrics(projectPath: string, packageJson: any): Promise<NpmMetrics> {
    const deps = Object.keys(packageJson.dependencies || {});
    const devDeps = Object.keys(packageJson.devDependencies || {});

    // Check for unused dependencies using depcheck
    let unusedDeps = 0;
    try {
      const result = childProcess.execSync('npx depcheck --json', {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 30000
      });
      const depcheckResult = JSON.parse(result);
      unusedDeps = (depcheckResult.dependencies || []).length + 
                    (depcheckResult.devDependencies || []).length;
    } catch {
      // depcheck might not be available
    }

    // Check node_modules size
    let nodeModulesSize = 0;
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      nodeModulesSize = await this.getDirectorySize(nodeModulesPath);
    }

    return {
      installTimeCold: 45, // Estimate
      installTimeCached: 8, // Estimate with cache
      nodeModulesSize,
      totalDeps: deps.length + devDeps.length,
      unusedDeps,
      outdatedDeps: 0 // Would need npm outdated to check
    };
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
    
    return Math.round(size / (1024 * 1024)); // Convert to MB
  }

  private async findDuplicates(projectPath: string): Promise<string[]> {
    // Would run npm ls and parse for duplicates
    // Simplified version
    return [];
  }

  private async findLargePackages(projectPath: string): Promise<{ name: string; sizeMB: number; alternatives: string[] }[]> {
    // Known large packages with alternatives
    const largePackages: Record<string, { alternatives: string[] }> = {
      'moment': { alternatives: ['date-fns', 'dayjs'] },
      'lodash': { alternatives: ['lodash-es', 'native methods'] },
      '@babel/core': { alternatives: ['swc', 'esbuild'] },
      'webpack': { alternatives: ['esbuild', 'vite', 'swc'] },
      'typescript': { alternatives: [] }, // No real alternative
    };

    const result: { name: string; sizeMB: number; alternatives: string[] }[] = [];
    
    // Would check node_modules sizes
    // Simplified version
    
    return result;
  }
}
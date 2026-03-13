/**
 * Dependency Analyzer
 * Analyzes package.json for optimization opportunities
 * Integrates with knip for unused dependency detection
 * 
 * Modes:
 * - Quick: knip + deprecated + duplicates (fast)
 * - Full: + npm outdated + npm audit (slower)
 * - Deep: + size analysis (slowest)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { Analyzer, AnalysisResult, Finding, Baseline, Savings, Domain } from '../types.js';

export interface DepsAnalyzerOptions {
  mode?: 'quick' | 'full' | 'deep';
  runNpmOutdated?: boolean;
  runNpmAudit?: boolean;
}

export class DepsAnalyzer implements Analyzer {
  name: Domain = 'deps';
  private options: DepsAnalyzerOptions;

  constructor(options: DepsAnalyzerOptions = {}) {
    this.options = {
      mode: 'full',
      ...options
    };
  }

  async isApplicable(projectPath: string): Promise<boolean> {
    return fs.existsSync(path.join(projectPath, 'package.json'));
  }

  async analyze(projectPath: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const baseline = await this.collectBaseline(projectPath);

    // Parse package.json
    const packageJson = await this.readPackageJson(projectPath);
    const packageLockExists = fs.existsSync(path.join(projectPath, 'package-lock.json'));
    const yarnLockExists = fs.existsSync(path.join(projectPath, 'yarn.lock'));
    const pnpmLockExists = fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'));

    // Run knip for unused dependencies
    const knipResult = await this.runKnip(projectPath);
    
    if (knipResult) {
      // Process unused dependencies
      for (const dep of knipResult.dependencies || []) {
        findings.push(this.createUnusedDepFinding(dep, packageJson));
      }

      // Process unused dev dependencies
      for (const dep of knipResult.devDependencies || []) {
        findings.push(this.createUnusedDepFinding(dep, packageJson, true));
      }

      // Process unused exports
      for (const item of knipResult.exports || []) {
        if (item.type === 'unused') {
          findings.push({
            id: `deps-006-${item.name}`,
            domain: 'deps',
            title: `Unused export: ${item.name}`,
            description: `Export '${item.name}' is defined but never used.`,
            evidence: {
              file: item.file,
              line: item.line
            },
            severity: 'low',
            confidence: 'high',
            impact: {
              type: 'size',
              estimate: 'Reduce bundle size by removing dead code',
              confidence: 'medium'
            },
            suggestedFix: {
              type: 'modify',
              file: item.file || 'unknown',
              description: 'Remove unused export',
              autoFixable: false
            },
            autoFixSafe: false
          });
        }
      }
    }

    // Finding: Missing lockfile
    if (!packageLockExists && !yarnLockExists && !pnpmLockExists) {
      findings.push({
        id: 'deps-003-lockfile',
        domain: 'deps',
        title: 'Missing lockfile',
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

    // Finding: Large packages (based on baseline)
    if (baseline.nodeModulesSizeMB && baseline.nodeModulesSizeMB > 200) {
      findings.push({
        id: 'deps-007-large-modules',
        domain: 'deps',
        title: `Large node_modules: ${baseline.nodeModulesSizeMB} MB`,
        description: 'node_modules exceeds 200 MB. Consider analyzing dependencies.',
        evidence: {
          metrics: {
            sizeMB: baseline.nodeModulesSizeMB
          }
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: `Potential savings: ${Math.round(baseline.nodeModulesSizeMB * 0.3)} MB`,
          confidence: 'low'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: 'Analyze dependencies with knip or depcheck',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Many dependencies
    if (baseline.dependencyCount > 50) {
      findings.push({
        id: 'deps-008-many-deps',
        domain: 'deps',
        title: `Many dependencies: ${baseline.dependencyCount}`,
        description: 'Project has more than 50 dependencies. Consider reducing.',
        evidence: {
          metrics: {
            count: baseline.dependencyCount
          }
        },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Larger install time and bundle size',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: 'Review and remove unnecessary dependencies',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Duplicates (simplified check)
    const duplicates = await this.findDuplicates(projectPath, packageJson);
    for (const dup of duplicates) {
      findings.push({
        id: `deps-002-${dup.name}`,
        domain: 'deps',
        title: `Duplicate dependency: ${dup.name}`,
        description: `Package ${dup.name} appears multiple times.`,
        evidence: {
          snippet: `"${dup.name}": "${dup.version}"`,
          metrics: {
            count: dup.count
          }
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Deduplicate to reduce size',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: 'Remove duplicate entry',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Deprecated packages (quick mode)
    const deprecated = await this.checkDeprecated(packageJson);
    findings.push(...deprecated);

    // Finding: Outdated packages (full mode)
    const outdated = await this.runNpmOutdated(projectPath);
    findings.push(...outdated);

    // Finding: Security vulnerabilities (full mode)
    const vulnerabilities = await this.runNpmAudit(projectPath);
    findings.push(...vulnerabilities);

    const savings = this.calculateSavings(findings, baseline);

    return {
      analyzer: 'deps',
      score: this.calculateScore(findings),
      findings,
      baseline,
      savings
    };
  }

  /**
   * Run knip and parse results
   */
  private async runKnip(projectPath: string): Promise<{
    dependencies?: string[];
    devDependencies?: string[];
    exports?: Array<{ name: string; file?: string; line?: number; type?: string }>;
  } | null> {
    try {
      // Run knip with JSON output
      const result = childProcess.execSync(
        'npx knip --no-progress --reporter json',
        {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      // Parse knip output
      const knipData = JSON.parse(result);
      
      return {
        dependencies: knipData.issues?.dependencies || [],
        devDependencies: knipData.issues?.devDependencies || [],
        exports: (knipData.issues?.exports || []).map((e: any) => ({
          name: e.name || e.identifier,
          file: e.file,
          line: e.line,
          type: 'unused'
        }))
      };
    } catch (error: any) {
      // knip returns non-zero exit code when issues are found
      // Try to parse stderr for JSON
      try {
        const stderr = error.stderr || error.stdout || '';
        // Find JSON in output
        const jsonMatch = stderr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const knipData = JSON.parse(jsonMatch[0]);
          return {
            dependencies: knipData.issues?.dependencies || knipData.dependencies || [],
            devDependencies: knipData.issues?.devDependencies || knipData.devDependencies || [],
            exports: []
          };
        }
      } catch {
        // knip not available or parse error
      }
      
      // Return null if knip fails
      return null;
    }
  }

  /**
   * Create finding for unused dependency
   */
  private createUnusedDepFinding(
    depName: string, 
    packageJson: any, 
    isDev: boolean = false
  ): Finding {
    const version = (packageJson.dependencies || {})[depName] || 
                    (packageJson.devDependencies || {})[depName] ||
                    'unknown';

    return {
      id: `deps-001-${depName}`,
      domain: 'deps',
      title: `Unused ${isDev ? 'dev ' : ''}dependency: ${depName}`,
      description: `Package '${depName}' is in ${isDev ? 'devDependencies' : 'dependencies'} but never imported.`,
      evidence: {
        file: 'package.json',
        snippet: `"${depName}": "${version}"`,
        metrics: {
          unusedCount: 1
        }
      },
      severity: 'medium',
      confidence: 'high',
      impact: {
        type: 'size',
        estimate: `Remove to reduce node_modules size`,
        confidence: 'high'
      },
      suggestedFix: {
        type: 'modify',
        file: 'package.json',
        description: `Remove ${depName} from ${isDev ? 'devDependencies' : 'dependencies'}`,
        diff: `-    "${depName}": "${version}",`,
        autoFixable: true
      },
      autoFixSafe: true
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
      projectType: this.detectProjectType(packageJson),
      hasPackageJson: true,
      hasDockerfile: fs.existsSync(path.join(projectPath, 'Dockerfile')),
      hasCi: fs.existsSync(path.join(projectPath, '.github/workflows')) ||
             fs.existsSync(path.join(projectPath, '.gitlab-ci.yml')),
      dependencyCount: deps + devDeps,
      nodeModulesSizeMB: nodeModulesSize
    };
  }

  private detectProjectType(pkg: any): string {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.next || deps['next.js']) return 'nextjs';
    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps.angular || deps['@angular/core']) return 'angular';
    if (deps.svelte) return 'svelte';
    if (deps.express || deps.fastify || deps.koa) return 'nodejs-backend';
    if (deps.nestjs || deps['@nestjs/core']) return 'nestjs';
    if (deps.typescript) return 'typescript';
    if (deps['react-native']) return 'react-native';

    return 'nodejs';
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
    let sizeMB = 0;

    // Estimate savings from unused deps
    const unusedCount = findings.filter(f => f.id.startsWith('deps-001')).length;
    sizeMB += unusedCount * 5; // ~5MB per unused dep on average

    // Estimate savings from duplicate removal
    const dupCount = findings.filter(f => f.id.startsWith('deps-002')).length;
    sizeMB += dupCount * 2;

    // Estimate savings from large modules
    const largeFinding = findings.find(f => f.id === 'deps-007-large-modules');
    if (largeFinding && baseline.nodeModulesSizeMB) {
      sizeMB += Math.round(baseline.nodeModulesSizeMB * 0.2); // Assume 20% savings
    }

    return {
      timeSeconds: 0,
      sizeMB: Math.round(sizeMB),
      percentImprovement: baseline.nodeModulesSizeMB ? 
        Math.round((sizeMB / baseline.nodeModulesSizeMB) * 100) : 0
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

  private async findDuplicates(projectPath: string, packageJson: any): Promise<Array<{ name: string; version: string; count: number }>> {
    const duplicates: Array<{ name: string; version: string; count: number }> = [];
    
    // Check if same package appears in both deps and devDeps
    const deps = Object.keys(packageJson.dependencies || {});
    const devDeps = Object.keys(packageJson.devDependencies || {});
    
    for (const dep of deps) {
      if (devDeps.includes(dep)) {
        duplicates.push({
          name: dep,
          version: packageJson.dependencies[dep],
          count: 2
        });
      }
    }
    
    return duplicates;
  }

  /**
   * Check for deprecated packages in package.json
   * Quick mode - no npm commands needed
   */
  private async checkDeprecated(packageJson: any): Promise<Finding[]> {
    const findings: Finding[] = [];
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Known deprecated packages
    const deprecatedPackages: Record<string, string> = {
      'request': 'Use axios, node-fetch, or native fetch instead',
      'left-pad': 'Use String.prototype.padStart instead',
      'babel-eslint': 'Use @babel/eslint-parser instead',
      'babel-preset-env': 'Use @babel/preset-env instead',
      'tslint': 'Use ESLint instead',
      'core-js@2': 'Use core-js@3 instead',
      'rxjs-compat': 'Use RxJS 6+ directly',
    };

    for (const [name, version] of Object.entries(allDeps)) {
      if (deprecatedPackages[name]) {
        findings.push({
          id: `deps-009-deprecated-${name}`,
          domain: 'deps',
          title: `Deprecated package: ${name}`,
          description: `Package '${name}' is deprecated. ${deprecatedPackages[name]}`,
          evidence: {
            file: 'package.json',
            snippet: `"${name}": "${version}"`
          },
          severity: 'medium',
          confidence: 'high',
          impact: {
            type: 'security',
            estimate: 'Security and maintenance risks',
            confidence: 'high'
          },
          suggestedFix: {
            type: 'modify',
            file: 'package.json',
            description: deprecatedPackages[name],
            autoFixable: false
          },
          autoFixSafe: false
        });
      }
    }

    return findings;
  }

  /**
   * Run npm outdated for version analysis
   * Full mode - requires npm
   */
  private async runNpmOutdated(projectPath: string): Promise<Finding[]> {
    if (this.options.mode === 'quick') {
      return [];
    }

    const findings: Finding[] = [];

    try {
      const result = childProcess.execSync(
        'npm outdated --json',
        {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      const outdated = JSON.parse(result);
      
      for (const [name, info] of Object.entries(outdated)) {
        const pkgInfo = info as { current: string; wanted: string; latest: string };
        
        const currentMajor = parseInt(pkgInfo.current.split('.')[0]);
        const latestMajor = parseInt(pkgInfo.latest.split('.')[0]);
        const majorDiff = latestMajor - currentMajor;

        findings.push({
          id: `deps-010-outdated-${name}`,
          domain: 'deps',
          title: `Outdated package: ${name}`,
          description: `Package '${name}' is ${majorDiff > 0 ? `${majorDiff} major versions` : 'versions'} behind.`,
          evidence: {
            file: 'package.json',
            snippet: `"${name}": "${pkgInfo.current}" → "${pkgInfo.latest}"`,
            metrics: { majorDiff }
          },
          severity: majorDiff >= 2 ? 'high' : majorDiff === 1 ? 'medium' : 'low',
          confidence: 'high',
          impact: {
            type: 'security',
            estimate: 'Potential security vulnerabilities in outdated version',
            confidence: 'medium'
          },
          suggestedFix: {
            type: 'modify',
            file: 'package.json',
            description: `Update: npm install ${name}@latest`,
            autoFixable: majorDiff === 0
          },
          autoFixSafe: majorDiff === 0
        });
      }
    } catch (error: any) {
      // npm outdated returns exit code 1 when packages are outdated
      try {
        const output = error.stdout || '';
        if (output) {
          const outdated = JSON.parse(output);
          for (const [name, info] of Object.entries(outdated)) {
            const pkgInfo = info as { current: string; wanted: string; latest: string };
            findings.push({
              id: `deps-010-outdated-${name}`,
              domain: 'deps',
              title: `Outdated package: ${name}`,
              description: `Package '${name}' has newer version available.`,
                evidence: { file: 'package.json', snippet: `"${name}": "${pkgInfo.current}" → "${pkgInfo.latest}"` },
              severity: 'low',
              confidence: 'high',
              impact: { type: 'security', estimate: 'Update for latest features', confidence: 'low' },
              suggestedFix: { type: 'modify', file: 'package.json', description: `npm install ${name}@latest`, autoFixable: false },
              autoFixSafe: false
            });
          }
        }
      } catch {
        // No outdated packages or npm not available
      }
    }

    return findings;
  }

  /**
   * Run npm audit for security vulnerabilities
   * Full mode - requires npm
   */
  private async runNpmAudit(projectPath: string): Promise<Finding[]> {
    if (this.options.mode === 'quick') {
      return [];
    }

    const findings: Finding[] = [];

    try {
      const result = childProcess.execSync(
        'npm audit --json',
        {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      // No vulnerabilities
      return findings;
    } catch (error: any) {
      // npm audit returns exit code 1 when vulnerabilities found
      try {
        const output = error.stdout || '';
        if (output) {
          const audit = JSON.parse(output);
          if (audit.vulnerabilities) {
            for (const [name, info] of Object.entries(audit.vulnerabilities)) {
              const vuln = info as { name: string; severity: string; via: string[]; fixAvailable?: boolean };
              const severity = vuln.severity === 'critical' || vuln.severity === 'high' ? 'critical' : 
                               vuln.severity === 'moderate' ? 'high' : 'medium';
              findings.push({
                id: `deps-011-vuln-${name}`,
                domain: 'deps',
                title: `Vulnerability in ${name}: ${vuln.severity}`,
                description: `Package '${name}' has ${vuln.severity} security vulnerability.`,
                evidence: { file: 'package.json', snippet: `"${name}"` },
                severity: severity as 'critical' | 'high' | 'medium' | 'low',
                confidence: 'high',
                impact: { type: 'security', estimate: 'Security vulnerability requires attention', confidence: 'high' },
                suggestedFix: { type: 'modify', file: 'package.json', description: vuln.fixAvailable ? 'npm audit fix' : 'Manual review required', autoFixable: vuln.fixAvailable ? true : false },
                autoFixSafe: false
              });
            }
          }
        }
      } catch {
        // npm not available or parse error
      }
    }

    return findings;
  }
}
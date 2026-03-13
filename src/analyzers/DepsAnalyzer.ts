/**
 * Dependency Analyzer
 * Analyzes package.json for optimization opportunities
 * Integrates with knip for unused dependency detection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
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
}
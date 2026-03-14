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
import { Analyzer, AnalysisResult, Finding, Baseline, Savings, Domain, Severity, Confidence } from '../types.js';

interface DepsAnalyzerOptions {
  mode?: 'quick' | 'full' | 'deep';
  runNpmOutdated?: boolean;
  runNpmAudit?: boolean;
}

interface KnipResult {
  dependencies: string[];
  devDependencies: string[];
  exports: Array<{ name: string; file: string; line?: number; type: string }>;
  files: Array<{ file: string; description?: string }>;
  types: Array<{ name: string; file: string; line?: number; type: string }>;
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

    // Run knip for unused dependencies (skip in quick mode for speed)
    const knipResult: KnipResult | null = this.options.mode === 'quick'
      ? null
      : await this.runKnip(projectPath);
    
    if (knipResult) {
      // Process unused dependencies
      for (const dep of knipResult.dependencies || []) {
        const depName = typeof dep === 'string' ? dep : (dep as any).name || String(dep);
        findings.push(this.createUnusedDepFinding(depName, packageJson, false, projectPath));
      }

      // Process unused dev dependencies
      for (const dep of knipResult.devDependencies || []) {
        const depName = typeof dep === 'string' ? dep : (dep as any).name || String(dep);
        findings.push(this.createUnusedDepFinding(depName, packageJson, true, projectPath));
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
      
      // NEW: Process unused files
      for (const file of knipResult.files || []) {
        findings.push({
          id: `deps-unused-file-${file.file.replace(/[^a-zA-Z0-9]/g, '-')}`,
          domain: 'deps',
          title: `Unused file: ${file.file}`,
          description: file.description || `File '${file.file}' is not imported anywhere.`,
          evidence: { file: file.file },
          severity: 'medium',
          confidence: 'high',
          impact: {
            type: 'maintenance',
            estimate: 'Dead code increases repository size',
            confidence: 'medium'
          },
          suggestedFix: {
            type: 'delete',
            file: file.file,
            description: 'Delete unused file',
            autoFixable: false
          },
          autoFixSafe: false
        });
      }
      
      // NEW: Process unused types
      for (const type of knipResult.types || []) {
        findings.push({
          id: `deps-unused-type-${type.name}`,
          domain: 'deps',
          title: `Unused type: ${type.name}`,
          description: `Type '${type.name}' in ${type.file} is never used.`,
          evidence: { file: type.file, line: type.line },
          severity: 'low',
          confidence: 'high',
          impact: {
            type: 'maintenance',
            estimate: 'Dead types clutter codebase',
            confidence: 'medium'
          },
          suggestedFix: {
            type: 'delete',
            file: type.file,
            description: `Remove unused type '${type.name}'`,
            autoFixable: false
          },
          autoFixSafe: false
        });
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

    // Finding: Duplicate versions in dependency tree (full mode)
    if (this.options.mode !== 'quick') {
      const duplicates = await this.findDuplicateVersions(projectPath);
      findings.push(...duplicates);
    }

    // Finding: Outdated packages (full mode)
    const outdated = await this.runNpmOutdated(projectPath);
    findings.push(...outdated);

    // Finding: Security vulnerabilities (full mode)
    const vulnerabilities = await this.runNpmAudit(projectPath);
    findings.push(...vulnerabilities);

    // Finding: Missing package-lock.json
    const lockFileFinding = this.checkPackageLock(projectPath);
    if (lockFileFinding) {
      findings.push(lockFileFinding);
    }

    // Finding: Missing engines in package.json
    const enginesFinding = this.checkEngines(packageJson);
    if (enginesFinding) {
      findings.push(enginesFinding);
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
  private async runKnip(projectPath: string): Promise<KnipResult | null> {
    try {
      // Run knip with JSON output
      // Note: knip outputs to stderr when issues found (exit code 1)
      let stdout = '';
      let stderr = '';
      
      try {
        stdout = childProcess.execSync(
          'npx knip --no-progress --reporter json',
          {
            cwd: projectPath,
            encoding: 'utf-8',
            timeout: 60000,
            stdio: ['pipe', 'pipe', 'pipe']
          }
        );
      } catch (error: any) {
        // knip returns exit code 1 when issues found
        stdout = error.stdout || '';
        stderr = error.stderr || '';
      }

      // Try to parse JSON from stdout first, then stderr
      let knipData;
      const jsonStr = stdout || stderr;
      
      if (!jsonStr) {
        return null;
      }
      
      try {
        knipData = JSON.parse(jsonStr);
      } catch {
        // Try to find JSON in output
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          knipData = JSON.parse(jsonMatch[0]);
        } else {
          return null;
        }
      }
      
      // Get issues from knip output
      // Knip returns: { files: [...], issues: [{ file, types: [...] }] }
      const issuesArray = knipData.issues || [];
      const filesList = knipData.files || [];
      
      // Aggregate all issues from all files
      const allDependencies: string[] = [];
      const allDevDependencies: string[] = [];
      const allExports: Array<{ name: string; file: string; line?: number; type: string }> = [];
      const allTypes: Array<{ name: string; file: string; line?: number; type: string }> = [];
      
      for (const fileIssues of issuesArray) {
        // Dependencies
        if (fileIssues.dependencies && fileIssues.dependencies.length > 0) {
          allDependencies.push(...fileIssues.dependencies);
        }
        if (fileIssues.devDependencies && fileIssues.devDependencies.length > 0) {
          allDevDependencies.push(...fileIssues.devDependencies.map((d: any) => d.name || d));
        }
        // Exports
        if (fileIssues.exports && fileIssues.exports.length > 0) {
          for (const e of fileIssues.exports) {
            allExports.push({
              name: e.name || e.identifier,
              file: fileIssues.file,
              line: e.line,
              type: 'unused'
            });
          }
        }
        // Types
        if (fileIssues.types && fileIssues.types.length > 0) {
          for (const t of fileIssues.types) {
            allTypes.push({
              name: t.name || t.identifier,
              file: fileIssues.file,
              line: t.line,
              type: 'unused-type'
            });
          }
        }
      }
      
      // Return parsed result
      return {
        dependencies: allDependencies,
        devDependencies: allDevDependencies,
        exports: allExports,
        // Unused files from top-level
        files: filesList.map((f: any) => {
          if (typeof f === 'string') {
            return { file: f, description: 'Unused file not imported anywhere' };
          }
          return { file: f.file || f, description: f.message || 'Unused file' };
        }),
        types: allTypes
      } as KnipResult;
    } catch (error: any) {
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
    isDev: boolean = false,
    projectPath: string = process.cwd()
  ): Finding {
    const version = (packageJson.dependencies || {})[depName] || 
                    (packageJson.devDependencies || {})[depName] ||
                    'unknown';

    // Verify dependency usage in code
    const usageResult = this.verifyDependencyUsage(depName, projectPath);
    
    const severity = usageResult.used ? 'low' : 'medium';
    const confidence = usageResult.used ? 'low' : 'high';
    const autoFixable = !usageResult.used;
    
    const description = usageResult.used
      ? `Package '${depName}' is marked as unused by knip but found ${usageResult.locations.length} usage(s) in code. May be false positive - verify manually.`
      : `Package '${depName}' is in ${isDev ? 'devDependencies' : 'dependencies'} but never imported.`;

    return {
      id: `deps-001-${depName}`,
      domain: 'deps',
      title: usageResult.used 
        ? `Potentially unused ${isDev ? 'dev ' : ''}dependency: ${depName} (verify)`
        : `Unused ${isDev ? 'dev ' : ''}dependency: ${depName}`,
      description,
      evidence: {
        file: 'package.json',
        snippet: `"${depName}": "${version}"`,
        metrics: usageResult.used ? {
          usageCount: usageResult.locations.length,
          firstLocation: usageResult.locations[0] || '',
          usageVerified: true
        } : {
          unusedCount: 1
        }
      },
      severity: severity as 'low' | 'medium' | 'high' | 'critical',
      confidence: confidence as 'low' | 'medium' | 'high',
      impact: {
        type: 'size',
        estimate: usageResult.used 
          ? 'Verify usage before removing - may be required'
          : 'Remove to reduce node_modules size',
        confidence: confidence
      },
      suggestedFix: {
        type: 'modify',
        file: 'package.json',
        description: usageResult.used
          ? `VERIFY FIRST: ${depName} appears to be used in ${usageResult.locations.length} file(s)`
          : `Remove ${depName} from ${isDev ? 'devDependencies' : 'dependencies'}`,
        diff: usageResult.used ? undefined : `-    "${depName}": "${version}",`,
        autoFixable: autoFixable
      },
      autoFixSafe: !usageResult.used
    };
  }

  /**
   * Verify if dependency is actually used in code
   * Returns usage locations if found
   */
  private verifyDependencyUsage(depName: string, projectPath: string): { used: boolean; locations: string[] } {
    const locations: string[] = [];
    const srcPath = path.join(projectPath, 'src');
    
    // Directories to search
    const searchDirs = [
      srcPath,
      path.join(projectPath, 'lib'),
      path.join(projectPath, 'app'),
      projectPath // Root as fallback
    ].filter(fs.existsSync);
    
    // Common import patterns
    const patterns = [
      `require\\(['"]${depName}['"]\\)`,
      `require\\(['"]${depName}/`,
      `from ['"]${depName}['"]`,
      `from ['"]${depName}/`,
      `import\\(['"]${depName}['"]\\)`,
      `import\\(['"]${depName}/`
    ];
    
    // Also check for common variations (scoped packages)
    const baseName = depName.replace(/^@[^/]+\//, '');
    if (baseName !== depName) {
      patterns.push(`require\\(['"][^'"]*${baseName}['"]\\)`);
      patterns.push(`from ['"][^'"]*${baseName}['"]`);
    }
    
    try {
      for (const searchDir of searchDirs) {
        const files = this.findFilesRecursively(searchDir, '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs');
        
        for (const file of files) {
          const content = fs.readFileSync(file, 'utf-8');
          
          for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'g');
            if (regex.test(content)) {
              const relativePath = path.relative(projectPath, file);
              locations.push(relativePath);
              break; // Found in this file, no need to check more patterns
            }
          }
          
          if (locations.length >= 10) break; // Enough evidence
        }
        
        if (locations.length >= 10) break;
      }
    } catch (error) {
      // Ignore errors during verification
    }
    
    return {
      used: locations.length > 0,
      locations
    };
  }

  /**
   * Find files recursively with given extensions
   */
  private findFilesRecursively(dir: string, ...extensions: string[]): string[] {
    const files: string[] = [];
    
    const traverse = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        // Skip node_modules, dist, build, .git
        if (entry.isDirectory()) {
          if (['node_modules', 'dist', 'build', '.git', 'coverage', '.next', '.nuxt'].includes(entry.name)) {
            continue;
          }
          traverse(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.some(e => ext === e || ext === `.${e}`)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    try {
      traverse(dir);
    } catch (error) {
      // Ignore errors
    }
    
    return files;
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
        case 'critical': score -= 20; break;
        case 'high': score -= 10; break;
        case 'medium': score -= 2; break;
        case 'low': score -= 1; break;
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
   * Check if version is pinned (exact version without ^ or ~)
   */
  private isPinnedVersion(version: string): boolean {
    // Pinned versions: 1.2.3 (no ^ or ~)
    // Not pinned: ^1.2.3, ~1.2.3, >=1.2.3, 1.x, *
    const pinnedPattern = /^\d+\.\d+\.\d+$/;
    return pinnedPattern.test(version);
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

    // Read package.json to check for pinned versions
    let packageJson: any = {};
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    } catch {
      // Ignore errors
    }

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
        
        // Check if version is pinned (intentional)
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const declaredVersion = deps[name] || '';
        const isPinned = this.isPinnedVersion(declaredVersion.replace(/^[@a-zA-Z]+\//, ''));
        
        // Reduce severity for pinned versions (may be intentional)
        const currentMajor = parseInt(pkgInfo.current.split('.')[0]);
        const latestMajor = parseInt(pkgInfo.latest.split('.')[0]);
        const majorDiff = latestMajor - currentMajor;

        // Adjust severity based on pinned status
        let severity: Severity = majorDiff >= 2 ? 'high' : majorDiff === 1 ? 'medium' : 'low';
        let confidence: Confidence = 'high';
        
        if (isPinned) {
          // Pinned version - may be intentional, reduce severity
          severity = majorDiff >= 2 ? 'medium' : 'low';
          confidence = 'medium'; // Less confident because could be intentional
        }

        findings.push({
          id: `deps-010-outdated-${name}`,
          domain: 'deps',
          title: `Outdated package: ${name}`,
          description: isPinned 
            ? `Package '${name}' is pinned to ${pkgInfo.current} but ${pkgInfo.latest} is available. May be intentional.`
            : `Package '${name}' is ${majorDiff > 0 ? `${majorDiff} major versions` : 'versions'} behind.`,
          evidence: {
            file: 'package.json',
            snippet: `"${name}": "${pkgInfo.current}" → "${pkgInfo.latest}"`,
            metrics: { 
              majorDiff,
              current: pkgInfo.current,
              latest: pkgInfo.latest,
              pinned: isPinned
            }
          },
          severity: severity,
          confidence: confidence,
          impact: {
            type: 'security',
            estimate: isPinned 
              ? 'Review if pinned version needs update'
              : 'Potential security vulnerabilities in outdated version',
            confidence: confidence
          },
          suggestedFix: {
            type: 'modify',
            file: 'package.json',
            description: isPinned
              ? `Verify pinned version is still needed: npm install ${name}@${pkgInfo.latest}`
              : `Update: npm install ${name}@latest`,
            autoFixable: !isPinned && majorDiff === 0
          },
          autoFixSafe: !isPinned && majorDiff === 0
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
              const vuln = info as { 
                name: string; 
                severity: string; 
                via: string[] | string; 
                fixAvailable?: boolean;
              };
              const severity = vuln.severity === 'critical' || vuln.severity === 'high' ? 'critical' : 
                               vuln.severity === 'moderate' ? 'high' : 'medium';
              
              // Extract CVE info
              const cveInfo = this.extractCVEInfo(vuln.via);
              const nvdLink = cveInfo.cve 
                ? `https://nvd.nist.gov/vuln/detail/${cveInfo.cve}`
                : `https://www.npmjs.com/advisories`;
              
              findings.push({
                id: `deps-security-${name}`,
                domain: 'deps',
                title: `[${vuln.severity.toUpperCase()}] ${name}${cveInfo.cve ? ` (${cveInfo.cve})` : ''}`,
                description: cveInfo.description || `Package '${name}' has ${vuln.severity} security vulnerability.`,
                evidence: { 
                  file: 'package.json', 
                  snippet: `"${name}"`,
                  metrics: { 
                    cve: cveInfo.cve || '',
                    severity: vuln.severity,
                    fixable: vuln.fixAvailable ? 1 : 0
                  }
                },
                severity: severity as 'critical' | 'high' | 'medium' | 'low',
                confidence: 'high',
                impact: { 
                  type: 'security', 
                  estimate: cveInfo.cve ? `CVE: ${cveInfo.cve}` : 'Security vulnerability',
                  confidence: 'high' 
                },
                suggestedFix: { 
                  type: 'modify', 
                  file: 'package.json', 
                  description: vuln.fixAvailable 
                    ? `npm audit fix${vuln.fixAvailable === true ? '' : ' --force'}` 
                    : `Update manually. See: ${nvdLink}`,
                  autoFixable: vuln.fixAvailable ? true : false
                },
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

  /**
   * Extract CVE information from vulnerability details
   */
  private extractCVEInfo(via: string[] | string): { cve: string | null; title: string | null; description: string | null } {
    if (!via) return { cve: null, title: null, description: null };
    
    const viaArray = Array.isArray(via) ? via : [via];
    const viaString = viaArray.join(' ');
    
    // Extract CVE ID (format: CVE-YYYY-NNNNN)
    const cveMatch = viaString.match(/CVE-\d{4}-\d{4,7}/i);
    const cve = cveMatch ? cveMatch[0] : null;
    
    // Extract title (first sentence)
    const title = viaArray[0]?.split('.')[0] || null;
    
    // Full description
    const description = viaArray.join('. ') || null;
    
    return { cve, title, description };
  }

  /**
   * Find duplicate versions in dependency tree
   */
  private async findDuplicateVersions(projectPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
      // Run npm ls --json --depth=Infinity to get full dependency tree
      const result = childProcess.execSync(
        'npm ls --json --depth=Infinity --silent 2>/dev/null || npm ls --json --depth=Infinity 2>/dev/null',
        {
          cwd: projectPath,
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large trees
        }
      );

      const tree = JSON.parse(result);
      const deps: Record<string, string[]> = {};

      // Traverse dependency tree
      const traverse = (obj: any, path = '') => {
        if (!obj || typeof obj !== 'object') return;
        
        if (obj.dependencies) {
          for (const [name, info] of Object.entries(obj.dependencies)) {
            const version = (info as any)?.version;
            if (version) {
              if (!deps[name]) deps[name] = [];
              if (!deps[name].includes(version)) {
                deps[name].push(version);
              }
            }
            traverse(info, path + '/' + name);
          }
        }
      };

      traverse(tree);

      // Find duplicates
      const duplicates = Object.entries(deps)
        .filter(([name, versions]) => versions.length > 1)
        .sort((a, b) => b[1].length - a[1].length);

      for (const [name, versions] of duplicates) {
        // Only report if versions are significantly different (not just patch)
        const hasMultipleMajor = versions.some(v => {
          const major = parseInt(v.split('.')[0], 10);
          const others = versions.filter(v2 => parseInt(v2.split('.')[0], 10) !== major);
          return others.length > 0;
        });

        if (hasMultipleMajor) {
          findings.push({
            id: `deps-duplicate-${name}`,
            domain: 'deps',
            title: `Duplicate versions of ${name}`,
            description: `Package ${name} has ${versions.length} different versions: ${versions.join(', ')}. This increases bundle size.`,
            evidence: {
              file: 'package.json',
              metrics: {
                versions: versions.length,
                package: name
              }
            },
            severity: 'medium',
            confidence: 'high',
            impact: {
              type: 'size',
              estimate: `Reduce bundle size by deduplicating ${name}`,
              confidence: 'medium'
            },
            suggestedFix: {
              type: 'modify',
              file: 'package.json',
              description: 'Run npm dedupe or update dependencies to use same version',
              autoFixable: false
            },
            autoFixSafe: false
          });
        }
      }
    } catch (error) {
      // npm ls failed - skip this check
    }

    return findings;
  }

  /**
   * Check for missing package-lock.json
   */
  private checkPackageLock(projectPath: string): Finding | null {
    const lockPath = path.join(projectPath, 'package-lock.json');
    
    if (!fs.existsSync(lockPath)) {
      return {
        id: 'deps-010',
        domain: 'deps',
        title: 'Missing package-lock.json',
        description: 'package-lock.json ensures consistent dependency versions across environments.',
        evidence: {
          file: 'package-lock.json',
        },
        severity: 'high',
        confidence: 'high',
        impact: {
          type: 'stability',
          estimate: 'Non-deterministic builds, version drift',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'create',
          file: 'package-lock.json',
          description: 'Run npm install to generate package-lock.json',
          diff: 'npm install',
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for missing engines in package.json
   */
  private checkEngines(packageJson: any): Finding | null {
    if (!packageJson.engines) {
      return {
        id: 'deps-011',
        domain: 'deps',
        title: 'Missing engines in package.json',
        description: '-engines- field specifies Node.js version compatibility, preventing runtime errors.',
        evidence: {
          file: 'package.json',
        },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'stability',
          estimate: 'Deployments may use incompatible Node.js version',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'package.json',
          description: 'Add engines field with Node.js version',
          diff: '+ "engines": { "node": ">=18.0.0" },',
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }
}
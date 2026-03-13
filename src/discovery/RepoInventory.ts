/**
 * Repo Inventory
 * Scans project to detect files, frameworks, and available analysis domains
 */

import * as fs from 'fs';
import * as path from 'path';
import { Baseline, Domain } from '../types.js';

export interface RepoInventory {
  rootPath: string;
  baseline: Baseline;
  availableDomains: Domain[];
  frameworks: string[];
  packageManager: string | null;
  ciPlatform: string | null;
}

export class RepoScanner {
  /**
   * Scan project and return inventory
   */
  async scan(projectPath: string): Promise<RepoInventory> {
    const rootPath = path.resolve(projectPath);
    
    const inventory: RepoInventory = {
      rootPath,
      baseline: await this.collectBaseline(rootPath),
      availableDomains: [],
      frameworks: [],
      packageManager: null,
      ciPlatform: null
    };

    // Detect package manager
    inventory.packageManager = this.detectPackageManager(rootPath);

    // Detect CI platform
    inventory.ciPlatform = this.detectCiPlatform(rootPath);

    // Detect frameworks
    inventory.frameworks = await this.detectFrameworks(rootPath);

    // Determine available domains
    inventory.availableDomains = this.determineAvailableDomains(inventory.baseline);

    return inventory;
  }

  /**
   * Collect baseline information about the project
   */
  private async collectBaseline(projectPath: string): Promise<Baseline> {
    const baseline: Baseline = {
      projectType: 'unknown',
      hasPackageJson: false,
      hasDockerfile: false,
      hasCi: false,
      dependencyCount: 0
    };

    // Check package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      baseline.hasPackageJson = true;
      
      try {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        const deps = Object.keys(pkg.dependencies || {}).length;
        const devDeps = Object.keys(pkg.devDependencies || {}).length;
        baseline.dependencyCount = deps + devDeps;
        
        // Determine project type
        baseline.projectType = this.detectProjectType(pkg);
      } catch (e) {
        // Invalid package.json
      }
    }

    // Check Dockerfile
    const dockerfile = path.join(projectPath, 'Dockerfile');
    const dockerfileLower = path.join(projectPath, 'dockerfile');
    if (fs.existsSync(dockerfile) || fs.existsSync(dockerfileLower)) {
      baseline.hasDockerfile = true;
    }

    // Check CI configs
    const githubActions = path.join(projectPath, '.github/workflows');
    const gitlabCi = path.join(projectPath, '.gitlab-ci.yml');
    const circleCi = path.join(projectPath, '.circleci');
    const jenkinsfile = path.join(projectPath, 'Jenkinsfile');

    if (fs.existsSync(githubActions) || 
        fs.existsSync(gitlabCi) || 
        fs.existsSync(circleCi) ||
        fs.existsSync(jenkinsfile)) {
      baseline.hasCi = true;
    }

    // Estimate node_modules size
    const nodeModules = path.join(projectPath, 'node_modules');
    if (fs.existsSync(nodeModules)) {
      baseline.nodeModulesSizeMB = await this.getDirectorySize(nodeModules);
    }

    // Estimate Docker image size (placeholder)
    baseline.dockerImageSize = baseline.hasDockerfile ? 1200 : undefined;

    // Estimate CI time
    if (baseline.hasCi) {
      baseline.ciTotalTime = await this.estimateCiTime(projectPath);
    }

    return baseline;
  }

  /**
   * Detect project type from package.json
   */
  private detectProjectType(pkg: any): string {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Framework detection
    if (deps.next || deps['next.js']) return 'nextjs';
    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps.angular || deps['@angular/core']) return 'angular';
    if (deps.svelte) return 'svelte';
    if (deps.express || deps.fastify || deps.koa) return 'nodejs-backend';
    if (deps.nestjs || deps['@nestjs/core']) return 'nestjs';
    if (deps.typescript) return 'typescript';
    if (deps.reactnative || deps['react-native']) return 'react-native';

    // Default
    return 'nodejs';
  }

  /**
   * Detect package manager
   */
  private detectPackageManager(projectPath: string): string | null {
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm';
    if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) return 'bun';
    return null;
  }

  /**
   * Detect CI platform
   */
  private detectCiPlatform(projectPath: string): string | null {
    if (fs.existsSync(path.join(projectPath, '.github/workflows'))) return 'github-actions';
    if (fs.existsSync(path.join(projectPath, '.gitlab-ci.yml'))) return 'gitlab-ci';
    if (fs.existsSync(path.join(projectPath, '.circleci'))) return 'circleci';
    if (fs.existsSync(path.join(projectPath, 'Jenkinsfile'))) return 'jenkins';
    if (fs.existsSync(path.join(projectPath, 'azure-pipelines.yml'))) return 'azure-pipelines';
    return null;
  }

  /**
   * Detect frameworks used
   */
  private async detectFrameworks(projectPath: string): Promise<string[]> {
    const frameworks: string[] = [];

    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return frameworks;

    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Framework patterns
      const frameworkPatterns: Record<string, string[]> = {
        'next.js': ['next', 'next.js'],
        'react': ['react'],
        'vue': ['vue'],
        'angular': ['@angular/core'],
        'svelte': ['svelte'],
        'express': ['express'],
        'fastify': ['fastify'],
        'nestjs': ['@nestjs/core'],
        'typescript': ['typescript'],
        'tailwind': ['tailwindcss'],
        'prisma': ['prisma'],
        'trpc': ['@trpc/server'],
        'graphql': ['graphql', 'apollo-server'],
        'testing': ['jest', 'vitest', 'mocha'],
        'storybook': ['@storybook/react'],
        'electron': ['electron'],
        'react-native': ['react-native']
      };

      for (const [framework, patterns] of Object.entries(frameworkPatterns)) {
        if (patterns.some(p => deps[p])) {
          frameworks.push(framework);
        }
      }
    } catch (e) {
      // Invalid package.json
    }

    return frameworks;
  }

  /**
   * Determine available domains based on detected files
   */
  private determineAvailableDomains(baseline: Baseline): Domain[] {
    const domains: Domain[] = [];

    if (baseline.hasDockerfile) {
      domains.push('docker');
    }

    if (baseline.hasPackageJson) {
      domains.push('deps');
    }

    if (baseline.hasCi) {
      domains.push('ci');
    }

    return domains;
  }

  /**
   * Get directory size in MB
   */
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

  /**
   * Estimate CI time from workflow files
   */
  private async estimateCiTime(projectPath: string): Promise<number> {
    const githubActionsPath = path.join(projectPath, '.github/workflows');
    
    if (!fs.existsSync(githubActionsPath)) {
      return 300; // Default 5 minutes
    }

    const workflowFiles = fs.readdirSync(githubActionsPath)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

    // Rough estimate: 5 minutes per workflow
    return workflowFiles.length * 300;
  }

  /**
   * Print inventory summary
   */
  printSummary(inventory: RepoInventory): string {
    const lines: string[] = [];

    lines.push(`📁 Project: ${inventory.rootPath}`);
    lines.push(`   Type: ${inventory.baseline.projectType}`);
    lines.push(`   Package Manager: ${inventory.packageManager || 'none'}`);
    lines.push(`   CI Platform: ${inventory.ciPlatform || 'none'}`);
    lines.push('');
    lines.push('📊 Stats:');
    lines.push(`   Dependencies: ${inventory.baseline.dependencyCount}`);
    
    if (inventory.baseline.nodeModulesSizeMB) {
      lines.push(`   node_modules: ${inventory.baseline.nodeModulesSizeMB} MB`);
    }
    
    if (inventory.baseline.dockerImageSize) {
      lines.push(`   Docker image (est.): ${inventory.baseline.dockerImageSize} MB`);
    }
    
    if (inventory.baseline.ciTotalTime) {
      lines.push(`   CI time (est.): ${Math.round(inventory.baseline.ciTotalTime / 60)} min`);
    }
    
    lines.push('');
    lines.push('🔍 Available analysis domains:');
    
    for (const domain of inventory.availableDomains) {
      const icon = { docker: '🐳', deps: '📦', ci: '🔄' }[domain];
      lines.push(`   ${icon} ${domain}`);
    }

    if (inventory.frameworks.length > 0) {
      lines.push('');
      lines.push('🛠️  Frameworks detected:');
      lines.push(`   ${inventory.frameworks.join(', ')}`);
    }

    return lines.join('\n');
  }
}
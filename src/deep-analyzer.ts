/**
 * Deep analysis module
 * Provides size estimates, bundle analysis, and detailed optimization suggestions
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Finding } from './types.js';

interface SizeEstimate {
  path: string;
  size: number;
  type: 'node_modules' | 'dist' | 'coverage' | 'cache' | 'other';
  recommendation: string;
}

export class DeepAnalyzer {
  /**
   * Estimate bundle size impact of dependencies
   */
  async estimateBundleImpact(projectPath: string, deps: string[]): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();

    for (const dep of deps) {
      try {
        // Try to get package size from node_modules
        const depPath = path.join(projectPath, 'node_modules', dep);
        if (fs.existsSync(depPath)) {
          const size = this.getDirSize(depPath);
          sizes.set(dep, size);
        }
      } catch {
        // Ignore errors
      }
    }

    return sizes;
  }

  /**
   * Find large directories that could be cleaned
   */
  async findLargeDirectories(projectPath: string, thresholdMB: number = 10): Promise<SizeEstimate[]> {
    const estimates: SizeEstimate[] = [];
    const dirs = [
      { path: 'node_modules', type: 'node_modules' as const },
      { path: 'dist', type: 'dist' as const },
      { path: 'build', type: 'dist' as const },
      { path: '.next', type: 'dist' as const },
      { path: 'coverage', type: 'coverage' as const },
      { path: '.cache', type: 'cache' as const },
      { path: '.npm', type: 'cache' as const }
    ];

    for (const dir of dirs) {
      const fullPath = path.join(projectPath, dir.path);
      if (fs.existsSync(fullPath)) {
        const size = this.getDirSize(fullPath);
        const sizeMB = size / (1024 * 1024);

        if (sizeMB > thresholdMB) {
          estimates.push({
            path: dir.path,
            size: sizeMB,
            type: dir.type,
            recommendation: this.getRecommendation(dir.path, sizeMB)
          });
        }
      }
    }

    return estimates;
  }

  /**
   * Analyze Docker image layers (if Dockerfile present)
   */
  async analyzeDockerLayers(projectPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dockerfilePath = path.join(projectPath, 'Dockerfile');

    if (!fs.existsSync(dockerfilePath)) {
      return findings;
    }

    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const lines = content.split('\n');

    // Estimate layer count
    const runCommands = lines.filter(l => l.trim().startsWith('RUN ')).length;
    const copyCommands = lines.filter(l => l.trim().startsWith('COPY ')).length;

    if (runCommands + copyCommands > 10) {
      findings.push({
        id: 'deep-layers',
        domain: 'docker',
        title: 'High layer count in Dockerfile',
        description: `Dockerfile has ${runCommands + copyCommands} potential layers. Consider combining commands.`,
        evidence: { file: 'Dockerfile', line: runCommands + copyCommands },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: `Save ~${(runCommands + copyCommands - 8) * 2} seconds build time`,
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Combine RUN commands with &&',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    return findings;
  }

  /**
   * Estimate CI minutes savings
   */
  async estimateCiSpeedup(projectPath: string, findings: Finding[]): Promise<{ current: number; potential: number; savings: string }> {
    // Base estimate: ~5 minutes average CI time
    let currentMinutes = 5;

    // Analyze findings to estimate savings
    for (const finding of findings) {
      if (finding.domain === 'ci') {
        if (finding.id.includes('cache')) {
          currentMinutes += 2; // Without cache takes longer
        }
        if (finding.id.includes('timeout')) {
          // Large timeout means potential runaway jobs
          currentMinutes += 10;
        }
        if (finding.id.includes('matrix')) {
          currentMinutes += 3; // Running multiple Node versions
        }
      }
    }

    // Estimate potential after fixes
    const savings = findings.length * 0.5; // ~30 seconds per fix
    const potential = Math.max(1, currentMinutes - savings);

    return {
      current: currentMinutes,
      potential: potential,
      savings: `~${Math.round(savings)} minutes saved`
    };
  }

  /**
   * Get size recommendations
   */
  async getSizeRecommendations(projectPath: string): Promise<{ category: string; current: string; potential: string; savings: string }[]> {
    const recommendations: { category: string; current: string; potential: string; savings: string }[] = [];

    // node_modules size
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      const size = this.getDirSize(nodeModulesPath) / (1024 * 1024);
      recommendations.push({
        category: 'Dependencies',
        current: `${Math.round(size)} MB`,
        potential: `${Math.round(size * 0.6)} MB`,
        savings: `${Math.round(size * 0.4)} MB (-40%)`
      });
    }

    // Build output size
    const distPath = path.join(projectPath, 'dist');
    if (fs.existsSync(distPath)) {
      const size = this.getDirSize(distPath) / (1024 * 1024);
      recommendations.push({
        category: 'Build Output',
        current: `${Math.round(size)} MB`,
        potential: `${Math.round(size * 0.7)} MB`,
        savings: `${Math.round(size * 0.3)} MB (-30%)`
      });
    }

    // Docker image estimate (if Dockerfile present)
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      // TODO: Use hadolint for actual image size estimate
      recommendations.push({
        category: 'Docker Image',
        current: '~500 MB',
        potential: '~150 MB',
        savings: '350 MB (-70%)'
      });
    }

    return recommendations;
  }

  // Private helpers

  private getDirSize(dir: string): number {
    let size = 0;

    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
          size += this.getDirSize(fullPath);
        } else {
          size += fs.statSync(fullPath).size;
        }
      }
    } catch {
      // Ignore permission errors
    }

    return size;
  }

  private getRecommendation(dir: string, sizeMB: number): string {
    switch (dir) {
      case 'node_modules':
        return sizeMB > 100
          ? 'Consider using pnpm or yarn with selective installs to reduce size'
          : 'Size is acceptable';
      case 'dist':
      case 'build':
      case '.next':
        return 'Add to .gitignore. Consider minification for production.';
      case 'coverage':
        return 'Add to .gitignore. Use in CI only.';
      case '.cache':
      case '.npm':
        return 'Clear periodically or use CI caching.';
      default:
        return 'Consider cleaning or adding to .gitignore.';
    }
  }
}
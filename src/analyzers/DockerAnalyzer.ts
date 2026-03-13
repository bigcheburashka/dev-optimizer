/**
 * Docker Analyzer
 * Analyzes Dockerfile for optimization opportunities
 */

import * as fs from 'fs';
import * as path from 'path';
import { Analyzer, AnalysisResult, Issue, Severity, DockerMetrics, Savings, Suggestion } from '../types.js';

export class DockerAnalyzer implements Analyzer {
  name = 'docker';

  async isApplicable(projectPath: string): Promise<boolean> {
    const dockerfile = path.join(projectPath, 'Dockerfile');
    const dockerfileLower = path.join(projectPath, 'dockerfile');
    return fs.existsSync(dockerfile) || fs.existsSync(dockerfileLower);
  }

  async analyze(projectPath: string): Promise<AnalysisResult> {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];
    let score = 100;

    // Parse Dockerfile
    const dockerfile = await this.readDockerfile(projectPath);
    const dockerignoreExists = await this.checkDockerignore(projectPath);

    // Check for .dockerignore
    if (!dockerignoreExists) {
      issues.push({
        type: 'missing_dockerignore',
        severity: 'high',
        message: 'Missing .dockerignore file',
        suggestion: 'Create .dockerignore with node_modules, .git, etc.',
        documentation: 'https://docs.docker.com/build/building/context/#dockerignore-files'
      });
      score -= 20;
      suggestions.push({
        type: 'create_dockerignore',
        description: 'Create .dockerignore file',
        impact: 'Save 200-500 MB in build context',
        autoFix: true,
        safe: true
      });
    }

    // Check for multistage
    const hasMultistage = this.checkMultistage(dockerfile);
    if (!hasMultistage) {
      issues.push({
        type: 'no_multistage',
        severity: 'high',
        message: 'No multistage build detected',
        suggestion: 'Use multistage build to reduce final image size',
        documentation: 'https://docs.docker.com/build/building/multi-stage/'
      });
      score -= 15;
      suggestions.push({
        type: 'add_multistage',
        description: 'Convert to multistage build',
        impact: 'Save 50-70% image size',
        autoFix: false,
        safe: false
      });
    }

    // Check base image
    const baseImage = this.getBaseImage(dockerfile);
    if (baseImage && !this.isAlpineBase(baseImage)) {
      issues.push({
        type: 'large_base_image',
        severity: 'medium',
        message: `Large base image: ${baseImage}`,
        suggestion: 'Consider using alpine-based image',
        documentation: 'https://hub.docker.com/_/alpine'
      });
      score -= 10;
      suggestions.push({
        type: 'switch_to_alpine',
        description: `Switch from ${baseImage} to alpine`,
        impact: 'Save 100-500 MB',
        autoFix: false,
        safe: false
      });
    }

    // Count layers
    const layerCount = this.countLayers(dockerfile);
    if (layerCount > 10) {
      issues.push({
        type: 'too_many_layers',
        severity: 'low',
        message: `Too many layers: ${layerCount}`,
        suggestion: 'Combine RUN commands to reduce layers',
        documentation: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#minimize-the-number-of-layers'
      });
      score -= Math.min(10, layerCount - 10);
    }

    // Check for cleanup
    const hasCleanup = this.checkCleanup(dockerfile);
    if (!hasCleanup) {
      issues.push({
        type: 'no_cleanup',
        severity: 'medium',
        message: 'No cleanup after apt/apk install',
        suggestion: 'Add cleanup commands: rm -rf /var/lib/apt/lists/*',
        documentation: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/'
      });
      score -= 10;
    }

    // Calculate potential savings
    const savings: Savings = {
      sizeMB: this.calculateSavings(issues, dockerignoreExists),
      timeSeconds: this.calculateTimeSavings(issues),
      percentImprovement: 0
    };
    savings.percentImprovement = savings.sizeMB > 0 ? Math.round((savings.sizeMB / 1000) * 100) : 0;

    const metrics: DockerMetrics = {
      imageSize: 1200, // Default estimate
      buildTime: 180,
      layerCount,
      contextSize: dockerignoreExists ? 50 : 500
    };

    return {
      analyzer: 'docker',
      score: Math.max(0, score),
      issues,
      suggestions,
      metrics: { docker: metrics },
      savings
    };
  }

  private async readDockerfile(projectPath: string): Promise<string> {
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    const dockerfileLowerPath = path.join(projectPath, 'dockerfile');
    
    const filePath = fs.existsSync(dockerfilePath) ? dockerfilePath : dockerfileLowerPath;
    return fs.readFileSync(filePath, 'utf-8');
  }

  private async checkDockerignore(projectPath: string): Promise<boolean> {
    return fs.existsSync(path.join(projectPath, '.dockerignore'));
  }

  private checkMultistage(dockerfile: string): boolean {
    return /^FROM\s+\S+\s+AS\s+\S+/m.test(dockerfile);
  }

  private getBaseImage(dockerfile: string): string | null {
    const match = dockerfile.match(/^FROM\s+(\S+)/m);
    return match ? match[1] : null;
  }

  private isAlpineBase(image: string): boolean {
    return image.includes('alpine') || image.includes('distroless') || image.includes('scratch');
  }

  private countLayers(dockerfile: string): number {
    const runCount = (dockerfile.match(/^RUN/gm) || []).length;
    const copyCount = (dockerfile.match(/^COPY/gm) || []).length;
    const addCount = (dockerfile.match(/^ADD/gm) || []).length;
    return runCount + copyCount + addCount + 1; // +1 for FROM
  }

  private checkCleanup(dockerfile: string): boolean {
    return /rm\s+-rf\s+\/var\/lib\/apt\/lists/.test(dockerfile) ||
           /rm\s+-rf\s+\/var\/cache\/apk/.test(dockerfile);
  }

  private calculateSavings(issues: Issue[], hasDockerignore: boolean): number {
    let savings = 0;
    
    if (issues.some(i => i.type === 'missing_dockerignore')) {
      savings += 300;
    }
    if (issues.some(i => i.type === 'no_multistage')) {
      savings += 500;
    }
    if (issues.some(i => i.type === 'large_base_image')) {
      savings += 200;
    }
    if (issues.some(i => i.type === 'no_cleanup')) {
      savings += 80;
    }
    
    return savings;
  }

  private calculateTimeSavings(issues: Issue[]): number {
    let savings = 0;
    
    if (issues.some(i => i.type === 'missing_dockerignore')) {
      savings += 30; // Smaller context = faster build
    }
    if (issues.some(i => i.type === 'no_multistage')) {
      savings += 60; // Parallel build stages
    }
    
    return savings;
  }
}
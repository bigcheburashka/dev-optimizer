/**
 * Docker Analyzer
 * Analyzes Dockerfile for optimization opportunities
 * Returns unified Finding[] format
 * 
 * Modes:
 * - Quick: Static analysis only
 * - Full: + hadolint linting (requires hadolint)
 * - Deep: + image layer analysis (requires docker)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { Analyzer, AnalysisResult, Finding, Baseline, Savings, Domain } from '../types.js';

export interface DockerAnalyzerOptions {
  mode?: 'quick' | 'full' | 'deep';
  runHadolint?: boolean;
}

export class DockerAnalyzer implements Analyzer {
  name: Domain = 'docker';
  private options: DockerAnalyzerOptions;

  constructor(options: DockerAnalyzerOptions = {}) {
    this.options = {
      mode: 'full',
      ...options
    };
  }

  async isApplicable(projectPath: string): Promise<boolean> {
    const dockerfile = path.join(projectPath, 'Dockerfile');
    const dockerfileLower = path.join(projectPath, 'dockerfile');
    return fs.existsSync(dockerfile) || fs.existsSync(dockerfileLower);
  }

  async analyze(projectPath: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const baseline = await this.collectBaseline(projectPath);

    // Parse Dockerfile
    const dockerfile = await this.readDockerfile(projectPath);
    const hasDockerignore = await this.checkDockerignore(projectPath);

    // Finding: Missing .dockerignore
    if (!hasDockerignore) {
      findings.push({
        id: 'docker-001',
        domain: 'docker',
        title: 'Missing .dockerignore file',
        description: 'No .dockerignore file found. Build context includes unnecessary files.',
        evidence: {
          metrics: {
            estimatedContextSizeMB: 500,
            potentialContextSizeMB: 50
          }
        },
        severity: 'high',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Reduce build context by 400-500 MB',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'create',
          file: '.dockerignore',
          description: 'Create .dockerignore with common patterns',
          diff: 'node_modules\n.git\n*.log\ncoverage\n.env\n.DS_Store',
          autoFixable: true
        },
        autoFixSafe: true
      });
    }

    // Finding: No multistage build
    if (!this.hasMultistage(dockerfile)) {
      findings.push({
        id: 'docker-002',
        domain: 'docker',
        title: 'No multistage build detected',
        description: 'Using single-stage build. Final image includes build dependencies.',
        evidence: {
          file: 'Dockerfile'
        },
        severity: 'high',
        confidence: 'medium',
        impact: {
          type: 'size',
          estimate: 'Reduce image size by 50-70%',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Convert to multistage build',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Large base image
    const baseImage = this.getBaseImage(dockerfile);
    if (baseImage && !this.isSmallBase(baseImage)) {
      findings.push({
        id: 'docker-003',
        domain: 'docker',
        title: `Large base image: ${baseImage}`,
        description: `Base image '${baseImage}' is large. Consider using alpine or distroless.`,
        evidence: {
          snippet: `FROM ${baseImage}`
        },
        severity: 'medium',
        confidence: 'medium',
        impact: {
          type: 'size',
          estimate: 'Save 100-500 MB per image',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: `Switch to alpine-based image`,
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: No cleanup after install
    if (!this.hasCleanup(dockerfile)) {
      findings.push({
        id: 'docker-004',
        domain: 'docker',
        title: 'No cleanup after package installation',
        description: 'Package manager caches not cleaned after install.',
        evidence: {
          file: 'Dockerfile'
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Save 50-200 MB per image',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Add cleanup commands after apt/apk install',
          diff: 'RUN apt-get install -y ... && rm -rf /var/lib/apt/lists/*',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Too many layers
    const layerCount = this.countLayers(dockerfile);
    if (layerCount > 10) {
      findings.push({
        id: 'docker-005',
        domain: 'docker',
        title: `Too many layers: ${layerCount}`,
        description: 'Excessive layers increase image size and build time.',
        evidence: {
          metrics: { layerCount }
        },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Save 10-50 MB by combining layers',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Combine RUN commands to reduce layers',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Layer optimization (consecutive RUN)
    const layerFinding = this.checkLayerOptimization(dockerfile);
    if (layerFinding) {
      findings.push(layerFinding);
    }

    // Finding: COPY vs ADD
    const copyFinding = this.checkCopyVsAdd(dockerfile);
    if (copyFinding) {
      findings.push(copyFinding);
    }

    // Finding: WORKDIR usage
    const workdirFinding = this.checkWorkdir(dockerfile);
    if (workdirFinding) {
      findings.push(workdirFinding);
    }

    // Finding: Hadolint (full mode)
    const hadolintFindings = await this.runHadolint(projectPath);
    findings.push(...hadolintFindings);

    const savings = this.calculateSavings(findings);

    return {
      analyzer: 'docker',
      score: this.calculateScore(findings),
      findings,
      baseline,
      savings
    };
  }

  private async collectBaseline(projectPath: string): Promise<Baseline> {
    return {
      projectType: 'docker',
      hasPackageJson: fs.existsSync(path.join(projectPath, 'package.json')),
      hasDockerfile: true,
      hasCi: fs.existsSync(path.join(projectPath, '.github/workflows')) ||
              fs.existsSync(path.join(projectPath, '.gitlab-ci.yml')),
      dependencyCount: 0,
      dockerImageSize: 1200 // Estimate
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

  private calculateSavings(findings: Finding[]): Savings {
    let timeSeconds = 0;
    let sizeMB = 0;

    for (const finding of findings) {
      if (finding.impact.type === 'size') {
        // Extract MB from estimate like "Reduce build context by 400-500 MB"
        const match = finding.impact.estimate.match(/(\d+)-?(\d+)?\s*MB/);
        if (match) {
          sizeMB += parseInt(match[1]) + (match[2] ? (parseInt(match[2]) - parseInt(match[1])) / 2 : 0);
        }
      }
      if (finding.impact.type === 'time') {
        const match = finding.impact.estimate.match(/(\d+)/);
        if (match) {
          timeSeconds += parseInt(match[1]);
        }
      }
    }

    return {
      timeSeconds,
      sizeMB: Math.round(sizeMB),
      percentImprovement: Math.round((sizeMB / 1000) * 100)
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

  private hasMultistage(dockerfile: string): boolean {
    return /^FROM\s+\S+\s+AS\s+\S+/m.test(dockerfile);
  }

  private getBaseImage(dockerfile: string): string | null {
    const match = dockerfile.match(/^FROM\s+(\S+)/m);
    return match ? match[1] : null;
  }

  private isSmallBase(image: string): boolean {
    return image.includes('alpine') || 
           image.includes('distroless') || 
           image.includes('scratch') ||
           image.includes('slim');
  }

  private hasCleanup(dockerfile: string): boolean {
    return /rm\s+-rf\s+\/var\/lib\/apt\/lists/.test(dockerfile) ||
           /rm\s+-rf\s+\/var\/cache\/apk/.test(dockerfile) ||
           /&&\s+rm\s+-rf/.test(dockerfile);
  }

  private countLayers(dockerfile: string): number {
    const runCount = (dockerfile.match(/^RUN/gm) || []).length;
    const copyCount = (dockerfile.match(/^COPY/gm) || []).length;
    const addCount = (dockerfile.match(/^ADD/gm) || []).length;
    return runCount + copyCount + addCount + 1;
  }

  /**
   * Check for layer optimization opportunities
   */
  private checkLayerOptimization(dockerfile: string): Finding | null {
    const lines = dockerfile.split('\n');
    const runCommands: number[] = [];
    
    lines.forEach((line, i) => {
      if (line.trim().startsWith('RUN')) {
        runCommands.push(i);
      }
    });

    // Check for consecutive RUN commands (can be combined)
    const consecutiveRuns: number[][] = [];
    let currentGroup: number[] = [];
    
    runCommands.forEach((idx, i) => {
      if (i === 0 || idx === runCommands[i - 1] + 1) {
        currentGroup.push(idx);
      } else {
        if (currentGroup.length > 1) consecutiveRuns.push(currentGroup);
        currentGroup = [idx];
      }
    });
    if (currentGroup.length > 1) consecutiveRuns.push(currentGroup);

    if (consecutiveRuns.length > 0) {
      return {
        id: 'docker-007',
        domain: 'docker',
        title: 'Multiple consecutive RUN commands',
        description: `Found ${consecutiveRuns.length} groups of consecutive RUN commands that can be combined to reduce layers.`,
        evidence: {
          file: 'Dockerfile',
          metrics: { groups: consecutiveRuns.length }
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: `Reduce layers by ${consecutiveRuns.length} and image size by 5-10 MB`,
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Combine consecutive RUN commands with &&',
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for COPY vs ADD usage
   */
  private checkCopyVsAdd(dockerfile: string): Finding | null {
    const addMatches = dockerfile.match(/^ADD\s+.+/gm);
    
    if (addMatches && addMatches.length > 0) {
      // Check if ADD is used for local files (should be COPY)
      const addForLocal = addMatches.filter(cmd => {
        const parts = cmd.split(/\s+/);
        // ADD with local source path (not URL)
        return parts.length >= 3 && !parts[1].startsWith('http') && !parts[1].startsWith('https');
      });

      if (addForLocal.length > 0) {
        return {
          id: 'docker-008',
          domain: 'docker',
          title: 'ADD used instead of COPY',
          description: `${addForLocal.length} ADD command(s) should be COPY for local files.`,
          evidence: {
            file: 'Dockerfile',
            snippet: addForLocal[0]
          },
          severity: 'low',
          confidence: 'high',
          impact: {
            type: 'security',
            estimate: 'COPY is more explicit and secure than ADD',
            confidence: 'high'
          },
          suggestedFix: {
            type: 'modify',
            file: 'Dockerfile',
            description: 'Replace ADD with COPY for local files',
            autoFixable: false
          },
          autoFixSafe: false
        };
      }
    }

    return null;
  }

  /**
   * Check for workdir usage
   */
  private checkWorkdir(dockerfile: string): Finding | null {
    const hasWorkdir = /^WORKDIR\s+/m.test(dockerfile);
    const hasCd = /cd\s+\//.test(dockerfile) || /&&\s*cd\s+/.test(dockerfile);

    if (!hasWorkdir && hasCd) {
      return {
        id: 'docker-009',
        domain: 'docker',
        title: 'Use WORKDIR instead of cd',
        description: 'Using cd commands instead of WORKDIR. WORKDIR is clearer and more maintainable.',
        evidence: {
          file: 'Dockerfile'
        },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'Improve Dockerfile readability',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Replace cd commands with WORKDIR',
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Run hadolint for advanced Dockerfile linting
   * Full mode - requires hadolint binary
   */
  private async runHadolint(projectPath: string): Promise<Finding[]> {
    if (this.options.mode === 'quick') {
      return [];
    }

    const findings: Finding[] = [];

    try {
      const dockerfilePath = path.join(projectPath, 'Dockerfile');
      const result = childProcess.execSync(
        `hadolint ${dockerfilePath} --format json`,
        {
          encoding: 'utf-8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      const issues = JSON.parse(result);
      
      for (const issue of issues) {
        // Map hadolint rules to findings
        const severity = issue.level === 'error' ? 'high' : 
                         issue.level === 'warning' ? 'medium' : 'low';
        
        findings.push({
          id: `docker-hadolint-${issue.code}`,
          domain: 'docker',
          title: `Hadolint: ${issue.code}`,
          description: issue.message,
          evidence: {
            file: 'Dockerfile',
            line: issue.line
          },
          severity: severity as 'high' | 'medium' | 'low',
          confidence: 'high',
          impact: {
            type: 'security',
            estimate: 'Dockerfile best practice violation',
            confidence: 'medium'
          },
          suggestedFix: {
            type: 'modify',
            file: 'Dockerfile',
            description: issue.message,
            autoFixable: false
          },
          autoFixSafe: false
        });
      }
    } catch (error: any) {
      // hadolint not installed or no issues
      // Add suggestion to install hadolint
      if (this.options.mode === 'deep') {
        findings.push({
          id: 'docker-hadolint-missing',
          domain: 'docker',
          title: 'Hadolint not available',
          description: 'Install hadolint for advanced Dockerfile linting.',
          evidence: {},
          severity: 'low',
          confidence: 'high',
          impact: {
            type: 'time',
            estimate: 'Additional Dockerfile analysis',
            confidence: 'low'
          },
          suggestedFix: {
            type: 'create',
            file: 'hadolint',
            description: 'Install hadolint: https://github.com/hadolint/hadolint',
            autoFixable: false
          },
          autoFixSafe: false
        });
      }
    }

    return findings;
  }
}
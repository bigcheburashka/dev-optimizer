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

interface DockerAnalyzerOptions {
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

    // Finding: COPY . . copies everything
    const copyAllFinding = this.checkCopyAll(dockerfile, hasDockerignore);
    if (copyAllFinding) {
      findings.push(copyAllFinding);
    }

    // Finding: pip install without --no-cache-dir
    const pipCacheFinding = this.checkPipCache(dockerfile);
    if (pipCacheFinding) {
      findings.push(pipCacheFinding);
    }

    // Finding: apt-get without --no-install-recommends
    const aptRecommendsFinding = this.checkAptRecommends(dockerfile);
    if (aptRecommendsFinding) {
      findings.push(aptRecommendsFinding);
    }

    // Finding: Using RUN chown instead of COPY --chown
    const chownFinding = this.checkChownUsage(dockerfile);
    if (chownFinding) {
      findings.push(chownFinding);
    }

    // Finding: Dev dependencies in production
    const devDepsFinding = this.checkDevDependencies(dockerfile);
    if (devDepsFinding) {
      findings.push(devDepsFinding);
    }

    // Finding: CLI tools that should be removed
    const cliToolsFinding = this.checkCliTools(dockerfile);
    if (cliToolsFinding) {
      findings.push(cliToolsFinding);
    }

    // Finding: User creation timing
    const userTimingFinding = this.checkUserCreation(dockerfile);
    if (userTimingFinding) {
      findings.push(userTimingFinding);
    }

    // Finding: FROM with latest tag
    const latestTagFinding = this.checkLatestTag(dockerfile);
    if (latestTagFinding) {
      findings.push(latestTagFinding);
    }

    // Finding: No HEALTHCHECK
    const healthcheckFinding = this.checkHealthcheck(dockerfile);
    if (healthcheckFinding) {
      findings.push(healthcheckFinding);
    }

    // Finding: No USER (running as root)
    const userFinding = this.checkUserDirective(dockerfile);
    if (userFinding) {
      findings.push(userFinding);
    }

    // Finding: ENV without quotes
    const envQuotesFinding = this.checkEnvQuotes(dockerfile);
    if (envQuotesFinding) {
      findings.push(envQuotesFinding);
    }

    // Finding: WORKDIR not absolute
    const workdirAbsFinding = this.checkWorkdirAbsolute(dockerfile);
    if (workdirAbsFinding) {
      findings.push(workdirAbsFinding);
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
        case 'critical': score -= 20; break;
        case 'high': score -= 10; break;
        case 'medium': score -= 2; break;
        case 'low': score -= 1; break;
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
   * Check for COPY . . (copies everything)
   */
  private checkCopyAll(dockerfile: string, hasDockerignore: boolean): Finding | null {
    const copyAllMatch = dockerfile.match(/COPY\s+\.\s+\.\s*$/m);
    
    if (copyAllMatch) {
      return {
        id: 'docker-010',
        domain: 'docker',
        title: 'COPY . . copies unnecessary files',
        description: 'COPY . . copies entire build context including .git, node_modules, tests, etc.',
        evidence: {
          file: 'Dockerfile',
          snippet: copyAllMatch[0].trim(),
          metrics: {
            estimatedWasteMB: hasDockerignore ? 100 : 500
          }
        },
        severity: hasDockerignore ? 'medium' : 'high',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: hasDockerignore ? 'Reduce image by 50-100 MB' : 'Reduce image by 200-500 MB',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: hasDockerignore ? 
            'Copy only needed directories: COPY src ./src' :
            'Create .dockerignore and copy only needed files',
          diff: hasDockerignore ? 
            '- COPY . .\n+ COPY src ./src' :
            '# .dockerignore:\nnode_modules/\n.git/\ntests/\ncoverage/\n\n# Dockerfile:\nCOPY src ./src',
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for pip install without --no-cache-dir
   */
  private checkPipCache(dockerfile: string): Finding | null {
    const pipMatch = dockerfile.match(/pip3?\s+install\s+(?!.*--no-cache)[^\n]*/gi);
    
    if (pipMatch) {
      return {
        id: 'docker-011',
        domain: 'docker',
        title: 'pip install without --no-cache-dir',
        description: 'pip stores cache in image, increasing size by 30-50 MB.',
        evidence: {
          file: 'Dockerfile',
          snippet: pipMatch[0],
          metrics: {
            estimatedWasteMB: 40
          }
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Reduce image size by 30-50 MB',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Add --no-cache-dir to pip install',
          diff: `- ${pipMatch[0]}\n+ ${pipMatch[0]} --no-cache-dir`,
          autoFixable: false
        },
        autoFixSafe: true
      };
    }

    return null;
  }

  /**
   * Check for apt-get without --no-install-recommends
   */
  private checkAptRecommends(dockerfile: string): Finding | null {
    const aptMatch = dockerfile.match(/apt-get\s+install\s+-y\s+(?!.*--no-install-recommends)[^\n]*/gi);
    
    if (aptMatch) {
      return {
        id: 'docker-012',
        domain: 'docker',
        title: 'apt-get without --no-install-recommends',
        description: 'apt-get installs recommended packages by default, increasing size by 50-150 MB.',
        evidence: {
          file: 'Dockerfile',
          snippet: aptMatch[0],
          metrics: {
            estimatedWasteMB: 100
          }
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Reduce image size by 50-150 MB',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Add --no-install-recommends to apt-get install',
          diff: `- apt-get install -y ${aptMatch[0].split(' ').slice(3).join(' ')}\n+ apt-get install -y --no-install-recommends ${aptMatch[0].split(' ').slice(3).join(' ')}`,
          autoFixable: false
        },
        autoFixSafe: true
      };
    }

    return null;
  }

  /**
   * Check for RUN chown instead of COPY --chown
   */
  private checkChownUsage(dockerfile: string): Finding | null {
    const chownMatch = dockerfile.match(/RUN\s+chown\s+-R\s+\S+\s+\/app/i);
    
    if (chownMatch) {
      return {
        id: 'docker-013',
        domain: 'docker',
        title: 'Using RUN chown instead of COPY --chown',
        description: 'RUN chown creates an additional layer (~50 MB). Use COPY --chown instead.',
        evidence: {
          file: 'Dockerfile',
          snippet: chownMatch[0],
          metrics: {
            estimatedWasteMB: 50
          }
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Reduce image size by 30-50 MB',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Use COPY --chown=user:group instead of RUN chown',
          diff: `- COPY . .\n- RUN chown -R node:node /app\n+ COPY --chown=node:node . .`,
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for npm ci --omit=dev or npm prune
   */
  private checkDevDependencies(dockerfile: string): Finding | null {
    const npmCiMatch = dockerfile.match(/npm\s+ci(?!\s+--omit=dev|\s+--production)/i);
    
    if (npmCiMatch) {
      // Check if npm prune is used
      const npmPruneMatch = dockerfile.match(/npm\s+prune\s+--production/i);
      
      if (!npmPruneMatch) {
        return {
          id: 'docker-014',
          domain: 'docker',
          title: 'npm ci installs devDependencies in production',
          description: 'npm ci installs all dependencies including devDependencies. Use --omit=dev or npm prune.',
          evidence: {
            file: 'Dockerfile',
            snippet: npmCiMatch[0],
            metrics: {
              estimatedWasteMB: 100
            }
          },
          severity: 'medium',
          confidence: 'medium',
          impact: {
            type: 'size',
            estimate: 'Reduce image size by 50-150 MB',
            confidence: 'medium'
          },
          suggestedFix: {
            type: 'modify',
            file: 'Dockerfile',
            description: 'Use npm ci --omit=dev or add npm prune --production',
            diff: `- npm ci\n+ npm ci --omit=dev`,
            autoFixable: false
          },
          autoFixSafe: true
        };
      }
    }

    return null;
  }

  /**
   * Check for CLI tools that should be removed in production
   */
  private checkCliTools(dockerfile: string): Finding | null {
    const cliPatterns = [
      { pattern: /npx\s+prisma\s+generate/gi, tool: 'Prisma CLI', removeable: 'npx prisma generate is needed during build, but Prisma CLI can be removed after' },
      { pattern: /npm\s+install\s+-g\s+typescript/gi, tool: 'TypeScript', removeable: 'TypeScript is dev-only tool' },
      { pattern: /npm\s+install\s+-g\s+eslint/gi, tool: 'ESLint', removeable: 'ESLint is dev-only tool' },
    ];

    const foundTools: Array<{ tool: string; removeable: string }> = [];

    for (const { pattern, tool, removeable } of cliPatterns) {
      if (pattern.test(dockerfile)) {
        foundTools.push({ tool, removeable });
      }
    }

    // Check for Prisma specifically
    const hasPrismaGenerate = /npx\s+prisma\s+generate/i.test(dockerfile);
    const hasPrismaRemove = /rm\s+.*node_modules\/prisma/i.test(dockerfile);

    if (hasPrismaGenerate && !hasPrismaRemove) {
      return {
        id: 'docker-015',
        domain: 'docker',
        title: 'Prisma CLI not removed from production image',
        description: 'Prisma CLI (~40 MB) and .prisma cache (~30 MB) remain in production image.',
        evidence: {
          file: 'Dockerfile',
          snippet: 'npx prisma generate',
          metrics: {
            estimatedWasteMB: 70
          }
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Reduce image size by 70 MB',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Remove Prisma CLI and cache after generating client',
          diff: `- RUN npx prisma generate\n+ RUN npx prisma generate && rm -rf node_modules/prisma node_modules/.prisma`,
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for user creation timing (should be early for COPY --chown)
   */
  private checkUserCreation(dockerfile: string): Finding | null {
    const lines = dockerfile.split('\n');
    let copyIndex = -1;
    let userAddIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('COPY') && copyIndex === -1) {
        copyIndex = i;
      }
      if ((line.includes('useradd') || line.includes('adduser')) && userAddIndex === -1) {
        userAddIndex = i;
      }
    }

    // If COPY comes before user creation, can't use COPY --chown
    if (copyIndex !== -1 && userAddIndex !== -1 && copyIndex < userAddIndex) {
      return {
        id: 'docker-016',
        domain: 'docker',
        title: 'User created after COPY (cannot use --chown)',
        description: 'Create user before COPY to use COPY --chown and avoid chown layer.',
        evidence: {
          file: 'Dockerfile',
          metrics: {
            estimatedWasteMB: 50
          }
        },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'size',
          estimate: 'Reduce image size by 30-50 MB',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Move user creation before COPY and use COPY --chown',
          diff: `- COPY src ./src\n- RUN useradd appuser && chown -R appuser:appuser /app\n+ RUN useradd appuser\n+ COPY --chown=appuser:appuser src ./src`,
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

  /**
   * Check for FROM with latest tag
   */
  private checkLatestTag(dockerfile: string): Finding | null {
    const latestMatch = dockerfile.match(/FROM\s+\S+:(latest|[\d]+\.[\d]+\.[\w\-]*)?\s*$/gm);
    
    if (latestMatch) {
      // Check if it's actually :latest or just version tag (like node:20)
      const hasLatest = latestMatch.some(m => m.includes(':latest'));
      if (hasLatest) {
        return {
          id: 'docker-017',
          domain: 'docker',
          title: 'FROM with :latest tag',
          description: 'Using :latest tag makes builds non-reproducible. Pin to specific version.',
          evidence: {
            file: 'Dockerfile',
            snippet: latestMatch.find(m => m.includes(':latest'))?.trim(),
          },
          severity: 'high',
          confidence: 'high',
          impact: {
            type: 'stability',
            estimate: 'Unpredictable builds, security issues',
            confidence: 'high'
          },
          suggestedFix: {
            type: 'modify',
            file: 'Dockerfile',
            description: 'Pin to specific version instead of :latest',
            diff: '- FROM node:latest\n+ FROM node:20.10.0',
          autoFixable: false
        },
          autoFixSafe: false
        };
      }
    }

    return null;
  }

  /**
   * Check for missing HEALTHCHECK
   */
  private checkHealthcheck(dockerfile: string): Finding | null {
    const hasHealthcheck = /^HEALTHCHECK\s/m.test(dockerfile);
    
    if (!hasHealthcheck) {
      return {
        id: 'docker-018',
        domain: 'docker',
        title: 'No HEALTHCHECK defined',
        description: 'Without HEALTHCHECK, container status is unknown. Kubernetes/Docker cannot detect unhealthy state.',
        evidence: {
          file: 'Dockerfile',
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'reliability',
          estimate: 'Containers may hang without recovery',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Add HEALTHCHECK instruction',
          diff: '+ HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\\n+   CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1',
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for USER directive (running as non-root)
   */
  private checkUserDirective(dockerfile: string): Finding | null {
    const hasUser = /^USER\s+\S+/m.test(dockerfile);
    
    if (!hasUser) {
      // Check if there's at least user creation
      const hasUserCreation = /useradd|adduser|groupadd/g.test(dockerfile);
      
      return {
        id: 'docker-019',
        domain: 'docker',
        title: 'Running as root user',
        description: 'Container runs as root by default. Security risk in production.',
        evidence: {
          file: 'Dockerfile',
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'security',
          estimate: 'Increased attack surface',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: hasUserCreation 
            ? 'Add USER directive after user creation'
            : 'Create non-root user and switch to it',
          diff: hasUserCreation
            ? '+ USER nodejs'
            : '+ RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs nodejs\n+ USER nodejs',
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for ENV without quotes
   */
  private checkEnvQuotes(dockerfile: string): Finding | null {
    const envLines = dockerfile.split('\n').filter(l => l.trim().startsWith('ENV'));
    const unquotedEnv: string[] = [];
    
    for (const line of envLines) {
      // ENV NAME=value (without quotes around value)
      const match = line.match(/ENV\s+\w+=(["']?)([^"'\s]+)\1/);
      if (match && !match[1]) {
        // Check if value contains spaces or special chars
        if (/[\s$()`\\]/.test(match[2])) {
          unquotedEnv.push(line.trim());
        }
      }
    }

    if (unquotedEnv.length > 0) {
      return {
        id: 'docker-020',
        domain: 'docker',
        title: 'ENV without quotes',
        description: 'ENV values with special characters should be quoted.',
        evidence: {
          file: 'Dockerfile',
          snippet: unquotedEnv[0],
        },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'stability',
          estimate: 'May cause unexpected behavior',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: 'Dockerfile',
          description: 'Quote ENV values',
          diff: `- ENV PATH=/app/bin:$PATH\n+ ENV PATH="/app/bin:$PATH"`,
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for WORKDIR with relative path
   */
  private checkWorkdirAbsolute(dockerfile: string): Finding | null {
    const workdirLines = dockerfile.split('\n').filter(l => l.trim().startsWith('WORKDIR'));
    
    for (const line of workdirLines) {
      const match = line.match(/WORKDIR\s+(.+)/);
      if (match) {
        const path = match[1].trim().replace(/['"]/g, '');
        if (!path.startsWith('/') && !path.startsWith('$')) {
          return {
            id: 'docker-021',
            domain: 'docker',
            title: 'WORKDIR with relative path',
            description: `WORKDIR should use absolute paths for predictability.`,
            evidence: {
              file: 'Dockerfile',
              snippet: line.trim(),
            },
            severity: 'low',
            confidence: 'high',
            impact: {
              type: 'stability',
              estimate: 'Unpredictable working directory',
              confidence: 'high'
            },
            suggestedFix: {
              type: 'modify',
              file: 'Dockerfile',
              description: 'Use absolute path for WORKDIR',
              diff: `- WORKDIR app\n+ WORKDIR /app`,
              autoFixable: false
            },
            autoFixSafe: false
          };
        }
      }
    }

    return null;
  }
}
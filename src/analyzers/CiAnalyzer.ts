/**
 * CI/CD Analyzer
 * Analyzes GitHub Actions and GitLab CI for optimization opportunities
 * Returns unified Finding[] format
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Analyzer, AnalysisResult, Finding, Baseline, Savings, Domain } from '../types.js';

export class CiAnalyzer implements Analyzer {
  name: Domain = 'ci';

  async isApplicable(projectPath: string): Promise<boolean> {
    const githubActions = path.join(projectPath, '.github/workflows');
    const gitlabCi = path.join(projectPath, '.gitlab-ci.yml');
    
    return fs.existsSync(githubActions) || fs.existsSync(gitlabCi);
  }

  async analyze(projectPath: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const baseline = await this.collectBaseline(projectPath);

    // Check for GitHub Actions
    const githubActionsPath = path.join(projectPath, '.github/workflows');
    if (fs.existsSync(githubActionsPath)) {
      const workflowFiles = fs.readdirSync(githubActionsPath)
        .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

      for (const file of workflowFiles) {
        const filePath = path.join(githubActionsPath, file);
        const workflowFindings = await this.analyzeWorkflow(filePath, file);
        findings.push(...workflowFindings);
      }
    }

    // Check for GitLab CI
    const gitlabCiPath = path.join(projectPath, '.gitlab-ci.yml');
    if (fs.existsSync(gitlabCiPath)) {
      const gitlabFindings = await this.analyzeGitLabCi(gitlabCiPath);
      findings.push(...gitlabFindings);
    }

    const savings = this.calculateSavings(findings);

    return {
      analyzer: 'ci',
      score: this.calculateScore(findings),
      findings,
      baseline,
      savings
    };
  }

  private async collectBaseline(projectPath: string): Promise<Baseline> {
    const githubActionsPath = path.join(projectPath, '.github/workflows');
    const hasCi = fs.existsSync(githubActionsPath) || 
                   fs.existsSync(path.join(projectPath, '.gitlab-ci.yml'));

    let totalTime = 0;
    
    // Estimate CI time from workflow files
    if (fs.existsSync(githubActionsPath)) {
      const workflowFiles = fs.readdirSync(githubActionsPath)
        .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      
      // Rough estimate: 5 minutes per workflow
      totalTime = workflowFiles.length * 300;
    }

    return {
      projectType: 'ci',
      hasPackageJson: fs.existsSync(path.join(projectPath, 'package.json')),
      hasDockerfile: fs.existsSync(path.join(projectPath, 'Dockerfile')),
      hasCi,
      dependencyCount: 0,
      ciTotalTime: totalTime
    };
  }

  private async analyzeWorkflow(filePath: string, fileName: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    const content = fs.readFileSync(filePath, 'utf-8');
    let workflow: any;

    try {
      workflow = yaml.parse(content);
    } catch (e) {
      findings.push({
        id: `ci-001-${fileName}`,
        domain: 'ci',
        title: `Invalid YAML in ${fileName}`,
        description: 'Workflow file contains YAML syntax errors and cannot be parsed.',
        evidence: { file: fileName },
        severity: 'critical',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'CI will fail to run',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Fix YAML syntax errors',
          autoFixable: false
        },
        autoFixSafe: false
      });
      return findings;
    }

    // Finding: Missing cache
    if (!this.hasCache(workflow)) {
      findings.push({
        id: `ci-002-${fileName}`,
        domain: 'ci',
        title: `No caching configured in ${fileName}`,
        description: 'Workflow does not use caching for dependencies. This increases CI time significantly.',
        evidence: {
          file: fileName,
          metrics: {
            estimatedTimeWithoutCache: 180,
            estimatedTimeWithCache: 30
          }
        },
        severity: 'high',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'Save 2-3 minutes per CI run',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Add cache configuration to setup-node or use actions/cache',
          autoFixable: true
        },
        autoFixSafe: true
      });
    }

    // Finding: No matrix strategy
    if (this.shouldHaveMatrix(workflow) && !this.hasMatrix(workflow)) {
      findings.push({
        id: `ci-003-${fileName}`,
        domain: 'ci',
        title: `No matrix strategy in ${fileName}`,
        description: 'Using single Node.js version. Matrix strategy allows testing multiple versions in parallel.',
        evidence: { file: fileName },
        severity: 'medium',
        confidence: 'medium',
        impact: {
          type: 'time',
          estimate: 'Test multiple Node versions simultaneously',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Add matrix strategy for Node versions',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Missing timeout
    if (!this.hasTimeout(workflow)) {
      findings.push({
        id: `ci-004-${fileName}`,
        domain: 'ci',
        title: `No timeout configured in ${fileName}`,
        description: 'Jobs without timeout can run indefinitely, wasting CI minutes.',
        evidence: { file: fileName },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'cost',
          estimate: 'Prevent runaway jobs (varies)',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Add timeout-minutes to jobs',
          autoFixable: true
        },
        autoFixSafe: true
      });
    }

    // Finding: Sequential jobs
    if (this.hasSequentialJobs(workflow)) {
      findings.push({
        id: `ci-005-${fileName}`,
        domain: 'ci',
        title: `Jobs run sequentially in ${fileName}`,
        description: 'Jobs could run in parallel using needs directive.',
        evidence: { file: fileName },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'Save 3-5 minutes through parallelization',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Use needs directive to create DAG for parallelization',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    return findings;
  }

  private async analyzeGitLabCi(filePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    const content = fs.readFileSync(filePath, 'utf-8');
    let gitlabCi: any;

    try {
      gitlabCi = yaml.parse(content);
    } catch (e) {
      findings.push({
        id: 'ci-001-gitlab',
        domain: 'ci',
        title: 'Invalid YAML in .gitlab-ci.yml',
        description: 'GitLab CI config contains YAML syntax errors.',
        evidence: { file: '.gitlab-ci.yml' },
        severity: 'critical',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'CI will fail to run',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: '.gitlab-ci.yml',
          description: 'Fix YAML syntax errors',
          autoFixable: false
        },
        autoFixSafe: false
      });
      return findings;
    }

    // Finding: Missing cache
    if (!this.hasGitLabCache(gitlabCi)) {
      findings.push({
        id: 'ci-006-gitlab',
        domain: 'ci',
        title: 'No caching configured in GitLab CI',
        description: 'GitLab CI configuration does not use caching for dependencies.',
        evidence: { file: '.gitlab-ci.yml' },
        severity: 'high',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'Save 2-3 minutes per pipeline run',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: '.gitlab-ci.yml',
          description: 'Add cache policy for node_modules',
          autoFixable: true
        },
        autoFixSafe: true
      });
    }

    return findings;
  }

  // Helper methods
  private hasCache(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      const jobObj = job as any;
      if (jobObj.steps) {
        for (const step of jobObj.steps) {
          if (step.uses?.includes('actions/cache') || step.with?.cache) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private hasGitLabCache(gitlabCi: any): boolean {
    for (const job of Object.values(gitlabCi)) {
      if ((job as any).cache) return true;
    }
    return false;
  }

  private hasMatrix(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      if ((job as any).strategy?.matrix) return true;
    }
    return false;
  }

  private shouldHaveMatrix(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      const steps = (job as any).steps || [];
      for (const step of steps) {
        if (step.uses?.includes('actions/setup-node')) {
          return true;
        }
      }
    }
    return false;
  }

  private hasTimeout(workflow: any): boolean {
    if (!workflow.jobs) return true;
    
    for (const job of Object.values(workflow.jobs)) {
      if ((job as any)['timeout-minutes']) return true;
    }
    return false;
  }

  private hasSequentialJobs(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    const jobNames = Object.keys(workflow.jobs);
    if (jobNames.length < 2) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      if ((job as any).needs) return false;
    }
    
    return true;
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

    for (const finding of findings) {
      // Extract time from estimate like "Save 2-3 minutes per CI run"
      const match = finding.impact.estimate.match(/(\d+)-?(\d+)?\s*(minute|min)/i);
      if (match) {
        const minutes = parseInt(match[1]);
        timeSeconds += minutes * 60;
      }
    }

    return {
      timeSeconds,
      sizeMB: 0,
      percentImprovement: 0
    };
  }
}
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

    // Finding: Artifact caching optimization
    const artifactFinding = this.checkArtifactCaching(workflow, fileName);
    if (artifactFinding) {
      findings.push(artifactFinding);
    }

    // Finding: Self-hosted runners opportunity
    const runnerFinding = this.checkSelfHostedRunners(workflow, fileName);
    if (runnerFinding) {
      findings.push(runnerFinding);
    }

    // Finding: Duplicate jobs
    const duplicateFinding = this.checkDuplicateJobs(workflow, fileName);
    if (duplicateFinding) {
      findings.push(duplicateFinding);
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
        id: 'ci-002-gitlab',
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

    // Finding: Missing stages optimization
    const stages = gitlabCi.stages || [];
    const jobCount = Object.keys(gitlabCi).filter(k => 
      k !== 'stages' && k !== 'variables' && k !== 'default' && k !== 'include'
    ).length;

    if (stages.length < 2 && jobCount > 3) {
      findings.push({
        id: 'ci-003-gitlab',
        domain: 'ci',
        title: 'Jobs not optimized with stages',
        description: 'GitLab CI has many jobs but few stages. Group jobs into stages for better parallelization.',
        evidence: { file: '.gitlab-ci.yml', metrics: { stages: stages.length, jobs: jobCount } },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'Save 20-30% pipeline time with proper stage ordering',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: '.gitlab-ci.yml',
          description: 'Define stages and assign jobs to stages',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Missing needs (DAG)
    const jobsWithoutNeeds = Object.keys(gitlabCi).filter(k => 
      k !== 'stages' && k !== 'variables' && k !== 'default' && k !== 'include' && 
      !(gitlabCi[k] as any)?.needs
    );

    if (jobCount > 2 && jobsWithoutNeeds.length > 1) {
      findings.push({
        id: 'ci-004-gitlab',
        domain: 'ci',
        title: 'Jobs run sequentially without needs',
        description: 'GitLab CI jobs could run in parallel using needs directive.',
        evidence: { file: '.gitlab-ci.yml' },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'Save 30-50% pipeline time with needs DAG',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: '.gitlab-ci.yml',
          description: 'Add needs directive for parallel execution',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Using extends (should use !reference or include)
    const jobsWithExtends = Object.entries(gitlabCi)
      .filter(([k, v]) => k !== 'stages' && k !== 'variables' && k !== 'default' && k !== 'include' && (v as any)?.extends)
      .length;

    if (jobsWithExtends > 0) {
      findings.push({
        id: 'ci-005-gitlab',
        domain: 'ci',
        title: 'Using deprecated extends keyword',
        description: `Found ${jobsWithExtends} jobs using 'extends'. Consider using !reference or include:template.`,
        evidence: { file: '.gitlab-ci.yml', metrics: { count: jobsWithExtends } },
        severity: 'low',
        confidence: 'medium',
        impact: {
          type: 'maintenance',
          estimate: 'Modern YAML anchors are more maintainable',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: '.gitlab-ci.yml',
          description: 'Consider using YAML anchors or include:template',
          autoFixable: false
        },
        autoFixSafe: false
      });
    }

    // Finding: Missing artifacts
    const jobsWithArtifacts = Object.entries(gitlabCi)
      .filter(([k, v]) => k !== 'stages' && k !== 'variables' && k !== 'default' && k !== 'include' && (v as any)?.artifacts)
      .length;

    if (jobCount > 0 && jobsWithArtifacts === 0) {
      findings.push({
        id: 'ci-006-gitlab',
        domain: 'ci',
        title: 'No artifacts defined',
        description: 'GitLab CI has no artifact configuration. Artifacts improve pipeline efficiency.',
        evidence: { file: '.gitlab-ci.yml' },
        severity: 'low',
        confidence: 'high',
        impact: {
          type: 'time',
          estimate: 'Artifacts improve job dependencies',
          confidence: 'low'
        },
        suggestedFix: {
          type: 'modify',
          file: '.gitlab-ci.yml',
          description: 'Add artifacts for build outputs',
          autoFixable: false
        },
        autoFixSafe: false
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

  /**
   * Check for artifact caching optimization
   */
  private checkArtifactCaching(workflow: any, fileName: string): Finding | null {
    const jobs = workflow.jobs || {};
    
    for (const [jobName, job] of Object.entries(jobs)) {
      const steps = (job as any)?.steps || [];
      
      // Check if using upload/download artifact without caching
      const hasUploadArtifact = steps.some((s: any) => 
        s.uses?.includes('upload-artifact') || s.uses?.includes('actions/upload-artifact')
      );
      
      if (hasUploadArtifact) {
        // Check for artifact retention optimization
        const hasRetention = steps.some((s: any) => 
          s.with?.retention_days || s.with?.['retention-days']
        );
        
        if (!hasRetention) {
          return {
            id: `ci-006-${fileName}`,
            domain: 'ci',
            title: `Artifact retention not optimized in ${fileName}`,
            description: 'Artifacts without retention settings use default 90 days, increasing storage costs.',
            evidence: { file: fileName },
            severity: 'low',
            confidence: 'medium',
            impact: {
              type: 'cost',
              estimate: 'Reduce storage costs with shorter retention',
              confidence: 'low'
            },
            suggestedFix: {
              type: 'modify',
              file: `.github/workflows/${fileName}`,
              description: 'Add retention-days to upload-artifact step',
              autoFixable: false
            },
            autoFixSafe: false
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Check for self-hosted runners opportunity
   */
  private checkSelfHostedRunners(workflow: any, fileName: string): Finding | null {
    const jobs = workflow.jobs || {};
    
    for (const [jobName, job] of Object.entries(jobs)) {
      const runsOn = (job as any)?.['runs-on'] || '';
      
      // Check if using expensive GitHub-hosted runners for long jobs
      if (typeof runsOn === 'string' && runsOn.includes('ubuntu')) {
        const steps = (job as any)?.steps || [];
        const stepCount = steps.length;
        
        // Estimate job complexity by step count
        if (stepCount > 5) {
          return {
            id: `ci-007-${fileName}`,
            domain: 'ci',
            title: `Consider self-hosted runners for ${fileName}`,
            description: 'Long-running jobs on GitHub-hosted runners can be expensive. Consider self-hosted runners for cost optimization.',
            evidence: { file: fileName, metrics: { stepCount } },
            severity: 'low',
            confidence: 'low',
            impact: {
              type: 'cost',
              estimate: 'Self-hosted runners can save 50-80% on CI costs',
              confidence: 'low'
            },
            suggestedFix: {
              type: 'modify',
              file: `.github/workflows/${fileName}`,
              description: 'Consider self-hosted runners for long-running jobs',
              autoFixable: false
            },
            autoFixSafe: false
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Check for duplicate job detection
   */
  private checkDuplicateJobs(workflow: any, fileName: string): Finding | null {
    const jobs = workflow.jobs || {};
    const jobSteps: Record<string, string[]> = {};
    
    for (const [jobName, job] of Object.entries(jobs)) {
      const steps = (job as any)?.steps || [];
      const stepNames = steps.map((s: any) => s.name || s.run || s.uses || '').filter(Boolean);
      jobSteps[jobName] = stepNames;
    }
    
    // Check for similar jobs
    const jobNames = Object.keys(jobSteps);
    for (let i = 0; i < jobNames.length; i++) {
      for (let j = i + 1; j < jobNames.length; j++) {
        const steps1 = jobSteps[jobNames[i]];
        const steps2 = jobSteps[jobNames[j]];
        
        // Calculate similarity
        const intersection = steps1.filter(s => steps2.includes(s));
        const similarity = intersection.length / Math.max(steps1.length, steps2.length);
        
        if (similarity > 0.7 && steps1.length > 2) {
          return {
            id: `ci-008-${fileName}`,
            domain: 'ci',
            title: `Duplicate jobs detected in ${fileName}`,
            description: `Jobs '${jobNames[i]}' and '${jobNames[j]}' have ${Math.round(similarity * 100)}% similar steps. Consider combining or using reusable workflows.`,
            evidence: { file: fileName },
            severity: 'medium',
            confidence: 'medium',
            impact: {
              type: 'cost',
              estimate: 'Consolidate to reduce CI minutes and maintenance',
              confidence: 'medium'
            },
            suggestedFix: {
              type: 'modify',
              file: `.github/workflows/${fileName}`,
              description: 'Consider using reusable workflows or combining similar jobs',
              autoFixable: false
            },
            autoFixSafe: false
          };
        }
      }
    }
    
    return null;
  }

  private calculateScore(findings: Finding[]): number {
    let score = 100;
    
    const seen = new Set<string>();
    
    for (const finding of findings) {
      // Deduplicate by ID
      if (seen.has(finding.id)) continue;
      seen.add(finding.id);
      
      switch (finding.severity) {
        case 'critical': score -= 15; break;
        case 'high': score -= 10; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
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
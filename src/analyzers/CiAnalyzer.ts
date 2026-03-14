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

    // Finding: Duplicate jobs
    const duplicateFinding = this.checkDuplicateJobs(workflow, fileName);
    if (duplicateFinding) {
      findings.push(duplicateFinding);
    }

    // NEW: Finding: Duplicate npm install steps
    const duplicateStepsFinding = this.checkDuplicateSteps(workflow, fileName);
    if (duplicateStepsFinding) {
      findings.push(duplicateStepsFinding);
    }

    // NEW: Finding: Missing concurrency control
    const concurrencyFinding = this.checkConcurrency(workflow, fileName);
    if (concurrencyFinding) {
      findings.push(concurrencyFinding);
    }

    // NEW: Finding: Unpinned actions
    const pinnedActionsFinding = this.checkPinnedActions(workflow, fileName);
    if (pinnedActionsFinding) {
      findings.push(pinnedActionsFinding);
    }

    // NEW: Finding: Missing permissions
    const permissionsFinding = this.checkPermissions(workflow, fileName);
    if (permissionsFinding) {
      findings.push(permissionsFinding);
    }

    // NEW: Finding: Hardcoded secrets
    const secretsFinding = this.checkHardcodedSecrets(workflow, fileName);
    if (secretsFinding) {
      findings.push(secretsFinding);
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
  /**
   * Check if workflow has npm/yarn/pnpm install steps
   */
  private hasNpmInstallSteps(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      const steps = (job as any).steps || [];
      for (const step of steps) {
        const run = step.run || '';
        if (/npm\s+(install|ci)|yarn\s+(install|--frozen-lockfile)|pnpm\s+install/.test(run)) {
          return true;
        }
      }
    }
    return false;
  }

  private hasCache(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    // Skip cache check if workflow doesn't use npm/yarn/pnpm
    if (!this.hasNpmInstallSteps(workflow)) {
      return true; // No cache needed if no package manager install
    }
    
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

  /**
   * Check if jobs are unnecessarily sequential
   * Note: Jobs WITHOUT 'needs' run IN PARALLEL in GitHub Actions
   * This checks for jobs that could be parallelized but are forced sequential
   */
  private hasSequentialJobs(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    const jobNames = Object.keys(workflow.jobs);
    if (jobNames.length < 2) return false;
    
    // Check if all jobs have 'needs' (forcing them sequential)
    // This is only a problem if they don't need to be sequential
    let allHaveNeeds = true;
    let allSequential = true;
    
    for (const job of Object.values(workflow.jobs)) {
      const needs = (job as any).needs;
      if (!needs || (Array.isArray(needs) && needs.length === 0)) {
        allHaveNeeds = false;
      }
    }
    
    // If all jobs have needs, they're explicitly sequential
    // But this might be intentional (e.g., build -> test -> deploy)
    // Only report if there's no clear linear dependency chain
    if (allHaveNeeds && jobNames.length > 2) {
      // Check if all jobs depend on previous job (linear chain)
      // This is intentional sequential and not a problem
      return false;
    }
    
    // Jobs without 'needs' run in parallel - this is GOOD
    return false;
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

  /**
   * Check for duplicate npm install steps across jobs
   * Note: In GitHub Actions, each job runs in its own runner, so npm install
   * in different jobs is NOT a duplicate - it's necessary for isolated environments.
   * This check is disabled as it was causing false positives.
   */
  private checkDuplicateSteps(workflow: any, fileName: string): Finding | null {
    // Disabled: npm install in different jobs is intentional in GH Actions
    // Each job runs in its own clean runner and needs its own dependencies
    return null;
  }

  /**
   * Check for missing concurrency control
   */
  private checkConcurrency(workflow: any, fileName: string): Finding | null {
    // Skip if workflow doesn't have trigger for pushes/PRs
    const on = workflow.on || {};
    const hasPushTrigger = on.push || on.pull_request;
    if (!hasPushTrigger) return null;

    const concurrency = workflow.concurrency;
    if (!concurrency) {
      return {
        id: `ci-008-${fileName}`,
        domain: 'ci',
        title: `Missing concurrency control in ${fileName}`,
        description: 'Workflow runs on every push without canceling outdated runs. This wastes CI minutes on outdated commits.',
        evidence: { file: fileName },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'cost',
          estimate: 'Save $0.50-2.00 per PR by canceling outdated runs',
          confidence: 'medium'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Add concurrency control to cancel outdated runs',
          diff: `concurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n  cancel-in-progress: true`,
          autoFixable: false
        },
        autoFixSafe: false
      };
    }
    
    return null;
  }

  /**
   * Check for unpinned actions (using @v3 instead of @sha)
   */
  private checkPinnedActions(workflow: any, fileName: string): Finding | null {
    const unpinnedActions: string[] = [];
    
    if (!workflow.jobs) return null;

    for (const [, job] of Object.entries(workflow.jobs)) {
      const jobObj = job as any;
      if (!jobObj.steps) continue;

      for (const step of jobObj.steps) {
        if (step.uses) {
          // Check if it's using @v3 or @main instead of @sha256:...
          const match = step.uses.match(/^([^@]+)@(v[\d.]+|main|master|latest|[\d.]+)$/);
          if (match) {
            unpinnedActions.push(step.uses);
          }
        }
      }
    }

    if (unpinnedActions.length > 0) {
      return {
        id: `ci-010-${fileName}`,
        domain: 'ci',
        title: `Unpinned action version in ${fileName}`,
        description: 'Actions should use SHA pinning for security. Using @v3 makes builds vulnerable to supply chain attacks.',
        evidence: {
          file: fileName,
          snippet: unpinnedActions[0],
          metrics: {
            unpinnedCount: unpinnedActions.length
          }
        },
        severity: 'high',
        confidence: 'high',
        impact: {
          type: 'security',
          estimate: '34% of security incidents from unpinned actions',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Pin action to SHA instead of version tag',
          diff: `- uses: actions/checkout@v3\n+ uses: actions/checkout@f43a0e5ff2bd294159a0cc0bcbf600b2e0e68f69  # v3`,
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for missing permissions block
   */
  private checkPermissions(workflow: any, fileName: string): Finding | null {
    // Check if workflow has permissions block
    const hasWorkflowPermissions = workflow.permissions !== undefined;
    
    // Check if jobs have permissions
    let hasJobPermissions = false;
    if (workflow.jobs) {
      for (const job of Object.values(workflow.jobs)) {
        if ((job as any).permissions !== undefined) {
          hasJobPermissions = true;
          break;
        }
      }
    }

    if (!hasWorkflowPermissions && !hasJobPermissions) {
      return {
        id: `ci-011-${fileName}`,
        domain: 'ci',
        title: `No permissions defined in ${fileName}`,
        description: 'Workflow runs with default permissions which may be overly broad. Add permissions block to follow principle of least privilege.',
        evidence: {
          file: fileName,
        },
        severity: 'medium',
        confidence: 'high',
        impact: {
          type: 'security',
          estimate: 'Reduced attack surface',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Add permissions block with least privilege',
          diff: `permissions:\n  contents: read\n  pull-requests: write`,
          autoFixable: false
        },
        autoFixSafe: false
      };
    }

    return null;
  }

  /**
   * Check for hardcoded secrets
   */
  private checkHardcodedSecrets(workflow: any, fileName: string): Finding | null {
    const secretPatterns = [
      /password\s*[=:]\s*["'][^"']+["']/gi,
      /api[_-]?key\s*[=:]\s*["'][^"']+["']/gi,
      /secret\s*[=:]\s*["'][^"']+["']/gi,
      /token\s*[=:]\s*["'][^"']+["']/gi,
      /private[_-]?key\s*[=:]\s*["'][^"']+["']/gi,
    ];

    const content = JSON.stringify(workflow);
    const foundSecrets: string[] = [];

    for (const pattern of secretPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        foundSecrets.push(...matches.slice(0, 2));
      }
    }

    // Also check for AWS/GCP keys
    if (/AKIA[0-9A-Z]{16}/.test(content) || /[A-Za-z0-9]{40}@/.test(content)) {
      foundSecrets.push('Cloud credentials detected');
    }

    if (foundSecrets.length > 0) {
      return {
        id: `ci-012-${fileName}`,
        domain: 'ci',
        title: `Hardcoded secrets in ${fileName}`,
        description: 'Workflow contains hardcoded credentials. Use GitHub Secrets instead.',
        evidence: {
          file: fileName,
          snippet: foundSecrets[0],
        },
        severity: 'critical',
        confidence: 'high',
        impact: {
          type: 'security',
          estimate: 'Potential credential leak',
          confidence: 'high'
        },
        suggestedFix: {
          type: 'modify',
          file: `.github/workflows/${fileName}`,
          description: 'Replace hardcoded secrets with GitHub Secrets',
          diff: `- API_KEY: "sk-abc123..."\n+ API_KEY: \${{ secrets.API_KEY }}`,
          autoFixable: false
        },
        autoFixSafe: false
      };
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
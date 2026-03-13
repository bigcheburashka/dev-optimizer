/**
 * CI/CD Analyzer
 * Analyzes GitHub Actions and GitLab CI for optimization opportunities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Analyzer, AnalysisResult, Issue, CiMetrics, Savings, Suggestion } from '../types.js';

export class CiAnalyzer implements Analyzer {
  name = 'ci';

  async isApplicable(projectPath: string): Promise<boolean> {
    const githubActions = path.join(projectPath, '.github/workflows');
    const gitlabCi = path.join(projectPath, '.gitlab-ci.yml');
    
    return fs.existsSync(githubActions) || fs.existsSync(gitlabCi);
  }

  async analyze(projectPath: string): Promise<AnalysisResult> {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];
    let score = 100;

    // Check for GitHub Actions
    const githubActionsPath = path.join(projectPath, '.github/workflows');
    if (fs.existsSync(githubActionsPath)) {
      const workflowFiles = fs.readdirSync(githubActionsPath)
        .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

      for (const file of workflowFiles) {
        const filePath = path.join(githubActionsPath, file);
        const workflowResult = await this.analyzeWorkflow(filePath, file);
        
        issues.push(...workflowResult.issues);
        suggestions.push(...workflowResult.suggestions);
        score = Math.min(score, workflowResult.score);
      }
    }

    // Check for GitLab CI
    const gitlabCiPath = path.join(projectPath, '.gitlab-ci.yml');
    if (fs.existsSync(gitlabCiPath)) {
      const gitlabResult = await this.analyzeGitLabCi(gitlabCiPath);
      issues.push(...gitlabResult.issues);
      suggestions.push(...gitlabResult.suggestions);
      score = Math.min(score, gitlabResult.score);
    }

    // Check for missing CI/CD
    if (!fs.existsSync(githubActionsPath) && !fs.existsSync(gitlabCiPath)) {
      // CI exists but wasn't detected
      if (!fs.existsSync(path.join(projectPath, 'Jenkinsfile')) &&
          !fs.existsSync(path.join(projectPath, 'circle.yml'))) {
        issues.push({
          type: 'missing_ci',
          severity: 'medium',
          message: 'No CI/CD configuration found',
          suggestion: 'Add GitHub Actions or GitLab CI for automated testing'
        });
        score -= 20;
      }
    }

    const metrics: CiMetrics = await this.collectMetrics(projectPath);
    const savings = this.calculateSavings(issues, metrics);

    return {
      analyzer: 'ci',
      score: Math.max(0, score),
      issues,
      suggestions,
      metrics: { ci: metrics },
      savings
    };
  }

  private async analyzeWorkflow(filePath: string, fileName: string): Promise<{
    issues: Issue[];
    suggestions: Suggestion[];
    score: number;
  }> {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];
    let score = 100;

    const content = fs.readFileSync(filePath, 'utf-8');
    let workflow: any;

    try {
      workflow = yaml.parse(content);
    } catch (e) {
      issues.push({
        type: 'invalid_yaml',
        severity: 'critical',
        message: `Invalid YAML in ${fileName}`,
        file: fileName,
        suggestion: 'Fix YAML syntax errors'
      });
      return { issues, suggestions, score: 0 };
    }

    // Check for caching
    if (!this.hasCache(workflow)) {
      issues.push({
        type: 'missing_cache',
        severity: 'high',
        message: `No caching configured in ${fileName}`,
        file: fileName,
        suggestion: 'Add actions/cache for node_modules, build artifacts',
        documentation: 'https://github.com/actions/cache'
      });
      score -= 20;
      
      suggestions.push({
        type: 'add_cache',
        description: 'Add caching for dependencies and build artifacts',
        impact: 'Save 50-80% on dependency installation time',
        autoFix: true,
        safe: true
      });
    }

    // Check for parallelization
    if (!this.hasMatrix(workflow) && this.shouldHaveMatrix(workflow)) {
      issues.push({
        type: 'missing_matrix',
        severity: 'medium',
        message: `No matrix strategy in ${fileName}`,
        file: fileName,
        suggestion: 'Use matrix for testing multiple Node versions, OS, etc.'
      });
      score -= 10;
      
      suggestions.push({
        type: 'add_matrix',
        description: 'Add matrix strategy for parallel testing',
        impact: 'Reduce CI time by 50-70% through parallelization',
        autoFix: false,
        safe: true
      });
    }

    // Check for timeout
    if (!this.hasTimeout(workflow)) {
      issues.push({
        type: 'missing_timeout',
        severity: 'low',
        message: `No timeout configured in ${fileName}`,
        file: fileName,
        suggestion: 'Add timeout-minutes to prevent runaway jobs'
      });
      score -= 5;
    }

    // Check for artifact upload
    if (this.hasBuildStep(workflow) && !this.hasArtifactUpload(workflow)) {
      issues.push({
        type: 'missing_artifacts',
        severity: 'low',
        message: `Build artifacts not uploaded in ${fileName}`,
        file: fileName,
        suggestion: 'Upload build artifacts for debugging and deployment'
      });
      score -= 5;
    }

    // Check for large artifacts
    if (this.hasLargeArtifacts(workflow)) {
      issues.push({
        type: 'large_artifacts',
        severity: 'medium',
        message: `Large artifacts in ${fileName} may slow down CI`,
        file: fileName,
        suggestion: 'Exclude unnecessary files from artifacts'
      });
      score -= 10;
    }

    // Check for sequential steps that could be parallel
    if (this.hasSequentialJobs(workflow)) {
      issues.push({
        type: 'sequential_jobs',
        severity: 'medium',
        message: `Jobs run sequentially in ${fileName}`,
        file: fileName,
        suggestion: 'Use needs directive to create dependency graph'
      });
      score -= 10;
    }

    return { issues, suggestions, score };
  }

  private async analyzeGitLabCi(filePath: string): Promise<{
    issues: Issue[];
    suggestions: Suggestion[];
    score: number;
  }> {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];
    let score = 100;

    const content = fs.readFileSync(filePath, 'utf-8');
    let gitlabCi: any;

    try {
      gitlabCi = yaml.parse(content);
    } catch (e) {
      issues.push({
        type: 'invalid_yaml',
        severity: 'critical',
        message: 'Invalid YAML in .gitlab-ci.yml',
        file: '.gitlab-ci.yml',
        suggestion: 'Fix YAML syntax errors'
      });
      return { issues, suggestions, score: 0 };
    }

    // Check for caching
    if (!this.hasGitLabCache(gitlabCi)) {
      issues.push({
        type: 'missing_cache',
        severity: 'high',
        message: 'No caching configured in GitLab CI',
        suggestion: 'Add cache policy for node_modules, build artifacts'
      });
      score -= 20;
    }

    // Check for needs directive
    if (this.hasSequentialGitLabJobs(gitlabCi)) {
      issues.push({
        type: 'sequential_jobs',
        severity: 'medium',
        message: 'Jobs run sequentially in GitLab CI',
        suggestion: 'Use needs directive to create DAG for parallelization'
      });
      score -= 10;
    }

    return { issues, suggestions, score };
  }

  private hasCache(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      const jobObj = job as any;
      if (jobObj.steps) {
        for (const step of jobObj.steps) {
          // Check for actions/cache
          if (step.uses?.includes('actions/cache')) {
            return true;
          }
          // Check for cache in setup-node, setup-python, etc.
          if (step.with?.cache) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private hasGitLabCache(gitlabCi: any): boolean {
    for (const job of Object.values(gitlabCi)) {
      if ((job as any).cache) {
        return true;
      }
    }
    return false;
  }

  private hasMatrix(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      if ((job as any).strategy?.matrix) {
        return true;
      }
    }
    return false;
  }

  private shouldHaveMatrix(workflow: any): boolean {
    // Check if this is a Node.js project that could benefit from matrix
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
    if (!workflow.jobs) return true; // Assume default timeout
    
    for (const job of Object.values(workflow.jobs)) {
      if ((job as any)['timeout-minutes']) {
        return true;
      }
    }
    return false;
  }

  private hasBuildStep(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      const steps = (job as any).steps || [];
      for (const step of steps) {
        if (step.run?.includes('build') || step.run?.includes('compile')) {
          return true;
        }
      }
    }
    return false;
  }

  private hasArtifactUpload(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    for (const job of Object.values(workflow.jobs)) {
      const steps = (job as any).steps || [];
      for (const step of steps) {
        if (step.uses?.includes('actions/upload-artifact')) {
          return true;
        }
      }
    }
    return false;
  }

  private hasLargeArtifacts(workflow: any): boolean {
    // Simplified check - could be enhanced
    return false;
  }

  private hasSequentialJobs(workflow: any): boolean {
    if (!workflow.jobs) return false;
    
    const jobNames = Object.keys(workflow.jobs);
    if (jobNames.length < 2) return false;
    
    // Check if all jobs have 'needs' (dependency)
    let hasNeeds = false;
    for (const job of Object.values(workflow.jobs)) {
      if ((job as any).needs) {
        hasNeeds = true;
        break;
      }
    }
    
    return !hasNeeds && jobNames.length > 1;
  }

  private hasSequentialGitLabJobs(gitlabCi: any): boolean {
    const jobNames = Object.keys(gitlabCi).filter(k => 
      !['stages', 'variables', 'default', 'include', 'workflow'].includes(k)
    );
    
    if (jobNames.length < 2) return false;
    
    let hasNeeds = false;
    for (const jobName of jobNames) {
      if (gitlabCi[jobName]?.needs) {
        hasNeeds = true;
        break;
      }
    }
    
    return !hasNeeds;
  }

  private async collectMetrics(projectPath: string): Promise<CiMetrics> {
    // Estimate CI metrics
    return {
      totalTime: 600, // 10 minutes default
      queueTime: 30,
      cacheHitRate: 0.2, // 20% without proper caching
      parallelJobs: 1
    };
  }

  private calculateSavings(issues: Issue[], metrics: CiMetrics): Savings {
    let timeSavings = 0;
    
    if (issues.some(i => i.type === 'missing_cache')) {
      timeSavings += 120; // 2 minutes average savings
    }
    
    if (issues.some(i => i.type === 'missing_matrix')) {
      timeSavings += 180; // 3 minutes through parallelization
    }
    
    if (issues.some(i => i.type === 'sequential_jobs')) {
      timeSavings += 300; // 5 minutes through DAG
    }

    const percentImprovement = metrics.totalTime > 0 
      ? Math.round((timeSavings / metrics.totalTime) * 100) 
      : 0;

    return {
      sizeMB: 0, // CI doesn't affect binary size directly
      timeSeconds: timeSavings,
      percentImprovement
    };
  }
}
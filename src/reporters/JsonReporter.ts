/**
 * JSON Reporter
 * Formats analysis results as JSON for CI pipelines and tooling
 */

import { FullReport, Finding } from '../types.js';

export class JsonReporter {
  format(report: FullReport): string {
    const output = {
      version: '1.0',
      tool: 'dev-optimizer',
      timestamp: report.timestamp,
      path: report.path,
      summary: {
        score: report.score,
        totalFindings: report.findings.length,
        bySeverity: this.countBySeverity(report.findings),
        byDomain: this.countByDomain(report.findings)
      },
      findings: report.findings.map(f => ({
        id: f.id,
        domain: f.domain,
        title: f.title,
        description: f.description,
        severity: f.severity,
        confidence: f.confidence,
        file: f.evidence?.file,
        line: f.evidence?.line,
        impact: f.impact,
        fix: f.suggestedFix ? {
          type: f.suggestedFix.type,
          file: f.suggestedFix.file,
          description: f.suggestedFix.description,
          autoFixable: f.suggestedFix.autoFixable,
          diff: f.suggestedFix.diff
        } : null
      })),
      baseline: {
        projectType: report.baseline.projectType,
        hasDockerfile: report.baseline.hasDockerfile,
        hasPackageJson: report.baseline.hasPackageJson,
        hasCi: report.baseline.hasCi,
        dependencyCount: report.baseline.dependencyCount
      },
      savings: report.totalSavings
    };

    return JSON.stringify(output, null, 2);
  }

  private countBySeverity(findings: Finding[]): Record<string, number> {
    return {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };
  }

  private countByDomain(findings: Finding[]): Record<string, number> {
    return {
      docker: findings.filter(f => f.domain === 'docker').length,
      deps: findings.filter(f => f.domain === 'deps').length,
      ci: findings.filter(f => f.domain === 'ci').length
    };
  }
}
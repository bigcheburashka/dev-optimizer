/**
 * Console Reporter
 * Formats analysis results for terminal output
 */

import chalk from 'chalk';
import { FullReport, Finding } from '../types.js';

export class ConsoleReporter {
  format(report: FullReport): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(chalk.bold('🔍 Dev Optimizer Report'));
    lines.push(chalk.gray(`Path: ${report.path}`));
    lines.push(chalk.gray(`Timestamp: ${report.timestamp}`));
    lines.push('');

    // Group vulnerabilities early
    const { vulnerabilities, otherFindings } = this.groupVulnerabilities(report.findings);
    
    // Score (cap minimum when vulnerabilities found)
    let displayScore = report.score;
    if (vulnerabilities.count > 0 && report.score < 10) {
      displayScore = Math.max(10, 35 - vulnerabilities.count);
    }
    
    const scoreColor = this.getScoreColor(displayScore);
    lines.push(chalk.bold('Score: ') + scoreColor(`${displayScore}/100`));
    lines.push('');

    // Baseline
    lines.push(chalk.bold('📊 Baseline'));
    lines.push(chalk.gray('─'.repeat(40)));
    lines.push(`Project: ${report.baseline.projectType || 'Unknown'}`);
    lines.push(`Dependencies: ${report.baseline.dependencyCount}`);
    lines.push(`Docker: ${report.baseline.hasDockerfile ? '✅' : '❌'}`);
    lines.push(`CI/CD: ${report.baseline.hasCi ? '✅' : '❌'}`);
    lines.push('');

    // Display vulnerability summary if any
    if (vulnerabilities.count > 0) {
      lines.push(chalk.bold('🔐 Security Vulnerabilities'));
      lines.push(chalk.gray('─'.repeat(40)));
      lines.push(chalk.red(`Found ${vulnerabilities.count} vulnerabilities:`));
      if (vulnerabilities.critical > 0) lines.push(chalk.red(`  • Critical: ${vulnerabilities.critical}`));
      if (vulnerabilities.high > 0) lines.push(chalk.red(`  • High: ${vulnerabilities.high}`));
      if (vulnerabilities.moderate > 0) lines.push(chalk.yellow(`  • Moderate: ${vulnerabilities.moderate}`));
      if (vulnerabilities.low > 0) lines.push(chalk.gray(`  • Low: ${vulnerabilities.low}`));
      lines.push(chalk.gray(`  Run: npm audit fix`));
      lines.push('');
    }

    // Top Findings (excluding grouped vulnerabilities)
    const topFindings = otherFindings
      .filter(f => f.severity === 'critical' || f.severity === 'high')
      .slice(0, 5);
      
    if (topFindings.length > 0) {
      lines.push(chalk.bold('🔴 Top Priority Issues'));
      lines.push(chalk.gray('─'.repeat(40)));
      
      for (const finding of topFindings) {
        lines.push(this.formatFinding(finding));
      }
    }

    // Quick Wins (unique, from otherFindings)
    const quickWins = otherFindings
      .filter(f => f.autoFixSafe || f.suggestedFix.autoFixable)
      .slice(0, 5);
      
    if (quickWins.length > 0) {
      lines.push('');
      lines.push(chalk.bold('💡 Quick Wins (Auto-fixable)'));
      lines.push(chalk.gray('─'.repeat(40)));
      
      for (const finding of quickWins) {
        lines.push(chalk.green(`✅ ${finding.title}`));
        lines.push(chalk.gray(`   Impact: ${finding.impact.estimate}`));
        lines.push(chalk.gray(`   Fix: ${finding.suggestedFix.description}`));
      }
    }

    // All Findings by Domain (excluding grouped vulnerabilities)
    lines.push('');
    lines.push(chalk.bold('📋 All Findings'));
    lines.push(chalk.gray('─'.repeat(40)));

    const dockerFindings = otherFindings.filter(f => f.domain === 'docker');
    const ciFindings = otherFindings.filter(f => f.domain === 'ci');
    const depsFindings = otherFindings.filter(f => f.domain === 'deps' && !f.id.includes('vuln'));

    if (dockerFindings.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('🐳 Docker'));
      lines.push(this.formatFindingsList(dockerFindings.slice(0, 10)));
      if (dockerFindings.length > 10) {
        lines.push(chalk.gray(`  ... and ${dockerFindings.length - 10} more`));
      }
    }

    if (ciFindings.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('🔄 CI/CD'));
      lines.push(this.formatFindingsList(ciFindings.slice(0, 10)));
      if (ciFindings.length > 10) {
        lines.push(chalk.gray(`  ... and ${ciFindings.length - 10} more`));
      }
    }

    if (depsFindings.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('📦 Dependencies'));
      lines.push(this.formatFindingsList(depsFindings.slice(0, 10)));
      if (depsFindings.length > 10) {
        lines.push(chalk.gray(`  ... and ${depsFindings.length - 10} more`));
      }
    }

    // Savings
    lines.push('');
    lines.push(chalk.bold('💰 Potential Savings'));
    lines.push(chalk.gray('─'.repeat(40)));
    
    if (report.totalSavings.sizeMB > 0) {
      lines.push(`Size: ${chalk.green(report.totalSavings.sizeMB + ' MB')}`);
    }
    if (report.totalSavings.timeSeconds > 0) {
      lines.push(`Time: ${chalk.green(Math.round(report.totalSavings.timeSeconds / 60) + ' min/CI run')}`);
    }
    if (report.totalSavings.percentImprovement > 0) {
      lines.push(`Improvement: ${chalk.green(report.totalSavings.percentImprovement + '%')}`);
    }
    lines.push('');

    return lines.join('\n');
  }

  private groupVulnerabilities(findings: Finding[]): { vulnerabilities: { count: number; critical: number; high: number; moderate: number; low: number }; otherFindings: Finding[] } {
    const vulnFindings = findings.filter(f => f.id.includes('vuln'));
    const otherFindings = findings.filter(f => !f.id.includes('vuln'));

    const vulnerabilities = {
      count: vulnFindings.length,
      critical: vulnFindings.filter(f => f.severity === 'critical').length,
      high: vulnFindings.filter(f => f.severity === 'high').length,
      moderate: vulnFindings.filter(f => f.severity === 'medium').length,
      low: vulnFindings.filter(f => f.severity === 'low').length
    };

    return { vulnerabilities, otherFindings };
  }

  private formatFinding(finding: Finding, defaultColor: string = 'white'): string {
    const lines: string[] = [];
    const severityColor = this.getSeverityColor(finding.severity);
    
    lines.push(severityColor(`[${finding.severity.toUpperCase()}]`) + ` ${finding.title}`);
    
    if (finding.evidence.file) {
      lines.push(chalk.gray(`   File: ${finding.evidence.file}`));
    }
    
    lines.push(chalk.gray(`   Impact: ${finding.impact.estimate}`));
    
    if (finding.suggestedFix.autoFixable) {
      lines.push(chalk.green(`   Fix: ${finding.suggestedFix.description} (auto-fixable)`));
    } else {
      lines.push(chalk.yellow(`   Suggestion: ${finding.suggestedFix.description}`));
    }
    
    return lines.join('\n');
  }

  private formatFindingsList(findings: Finding[]): string {
    const lines: string[] = [];
    
    for (const finding of findings) {
      const severityColor = this.getSeverityColor(finding.severity);
      const autoFix = finding.suggestedFix.autoFixable ? chalk.green(' ✅') : '';
      lines.push(`  ${severityColor('●')} ${finding.title}${autoFix}`);
    }
    
    return lines.join('\n');
  }

  private getScoreColor(score: number) {
    if (score >= 80) return chalk.green;
    if (score >= 60) return chalk.yellow;
    if (score >= 40) return chalk.hex('#FFA500');
    return chalk.red;
  }

  private getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical': return chalk.red;
      case 'high': return chalk.hex('#FF6600');
      case 'medium': return chalk.yellow;
      case 'low': return chalk.green;
      default: return chalk.gray;
    }
  }

  getExtension(): string {
    return '.txt';
  }
}
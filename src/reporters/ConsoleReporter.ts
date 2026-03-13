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

    // Score
    const scoreColor = this.getScoreColor(report.score);
    lines.push(chalk.bold('Score: ') + scoreColor(`${report.score}/100`));
    lines.push('');

    // Baseline
    lines.push(chalk.bold('📊 Baseline'));
    lines.push(chalk.gray('─'.repeat(40)));
    lines.push(`Project: ${report.baseline.projectType || 'Unknown'}`);
    lines.push(`Dependencies: ${report.baseline.dependencyCount}`);
    lines.push(`Docker: ${report.baseline.hasDockerfile ? '✅' : '❌'}`);
    lines.push(`CI/CD: ${report.baseline.hasCi ? '✅' : '❌'}`);
    lines.push('');

    // Top Findings
    if (report.topFindings.length > 0) {
      lines.push(chalk.bold('🔴 Top Findings'));
      lines.push(chalk.gray('─'.repeat(40)));
      
      for (const finding of report.topFindings.slice(0, 5)) {
        lines.push(this.formatFinding(finding));
      }
    }

    // Quick Wins
    if (report.quickWins.length > 0) {
      lines.push('');
      lines.push(chalk.bold('💡 Quick Wins (Auto-fixable)'));
      lines.push(chalk.gray('─'.repeat(40)));
      
      for (const finding of report.quickWins) {
        lines.push(chalk.green(`✅ ${finding.title}`));
        lines.push(chalk.gray(`   Impact: ${finding.impact.estimate}`));
        lines.push(chalk.gray(`   Fix: ${finding.suggestedFix.description}`));
      }
    }

    // Manual Review
    if (report.manualReview.length > 0) {
      lines.push('');
      lines.push(chalk.bold('⚠️  Requires Manual Review'));
      lines.push(chalk.gray('─'.repeat(40)));
      
      for (const finding of report.manualReview) {
        lines.push(this.formatFinding(finding, 'yellow'));
      }
    }

    // All Findings by Domain
    lines.push('');
    lines.push(chalk.bold('📋 All Findings'));
    lines.push(chalk.gray('─'.repeat(40)));

    const dockerFindings = report.findings.filter(f => f.domain === 'docker');
    const ciFindings = report.findings.filter(f => f.domain === 'ci');
    const depsFindings = report.findings.filter(f => f.domain === 'deps');

    if (dockerFindings.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('🐳 Docker'));
      lines.push(this.formatFindingsList(dockerFindings));
    }

    if (ciFindings.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('🔄 CI/CD'));
      lines.push(this.formatFindingsList(ciFindings));
    }

    if (depsFindings.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('📦 Dependencies'));
      lines.push(this.formatFindingsList(depsFindings));
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
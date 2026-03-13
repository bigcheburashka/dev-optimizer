/**
 * Console Reporter
 * Formats analysis results for terminal output
 */
import chalk from 'chalk';
export class ConsoleReporter {
    format(report) {
        const lines = [];
        // Header
        lines.push('');
        lines.push(chalk.bold('dev-optimizer Analysis Report'));
        lines.push(chalk.gray(`Path: ${report.path}`));
        lines.push(chalk.gray(`Timestamp: ${report.timestamp}`));
        lines.push('');
        // Overall score
        const scoreColor = this.getScoreColor(report.overallScore);
        lines.push(chalk.bold('Overall Score: ') + scoreColor(`${report.overallScore}/100`));
        lines.push('');
        // Docker analysis
        if (report.docker) {
            lines.push(this.formatSection('Whale', 'Docker', report.docker));
        }
        // npm analysis
        if (report.npm) {
            lines.push(this.formatSection('Package', 'npm', report.npm));
        }
        // CI/CD analysis
        if (report.ci) {
            lines.push(this.formatSection('Gear', 'CI/CD', report.ci));
        }
        // Bundle analysis
        if (report.bundle) {
            lines.push(this.formatSection('Box', 'Bundle', report.bundle));
        }
        // Security analysis
        if (report.security) {
            lines.push(this.formatSection('Lock', 'Security', report.security));
        }
        // Total savings
        lines.push('');
        lines.push(chalk.bold('Potential Savings'));
        lines.push(chalk.gray('─'.repeat(40)));
        lines.push(`Size: ${chalk.green(report.totalSavings.sizeMB + ' MB')}`);
        lines.push(`Time: ${chalk.green(report.totalSavings.timeSeconds + ' sec')}`);
        lines.push(`Improvement: ${chalk.green(report.totalSavings.percentImprovement + '%')}`);
        lines.push('');
        return lines.join('\n');
    }
    formatSection(emoji, name, result) {
        const lines = [];
        const scoreColor = this.getScoreColor(result.score);
        lines.push(`${this.getEmoji(emoji)} ${chalk.bold(name)}`);
        lines.push(chalk.gray('─'.repeat(40)));
        lines.push(`Score: ${scoreColor(`${result.score}/100`)}`);
        lines.push('');
        // Issues
        if (result.issues.length > 0) {
            lines.push(chalk.bold('Issues:'));
            for (const issue of result.issues) {
                const severityColor = this.getSeverityColor(issue.severity);
                lines.push(`  ${severityColor('●')} ${issue.message}`);
                if (issue.suggestion) {
                    lines.push(chalk.gray(`    → ${issue.suggestion}`));
                }
            }
            lines.push('');
        }
        // Suggestions
        if (result.suggestions.length > 0) {
            lines.push(chalk.bold('Suggestions:'));
            for (const suggestion of result.suggestions) {
                const fixBadge = suggestion.autoFix
                    ? chalk.green('[auto-fix]')
                    : chalk.yellow('[manual]');
                lines.push(`  ${fixBadge} ${suggestion.description}`);
                lines.push(chalk.gray(`    Impact: ${suggestion.impact}`));
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    getScoreColor(score) {
        if (score >= 80)
            return chalk.green;
        if (score >= 60)
            return chalk.yellow;
        if (score >= 40)
            return chalk.hex('#FFA500'); // Orange
        return chalk.red;
    }
    getSeverityColor(severity) {
        switch (severity) {
            case 'critical': return chalk.red;
            case 'high': return chalk.hex('#FF6600');
            case 'medium': return chalk.yellow;
            case 'low': return chalk.blue;
            default: return chalk.gray;
        }
    }
    getEmoji(name) {
        const emojis = {
            'Whale': '🐳',
            'Package': '📦',
            'Gear': '⚙️',
            'Box': '📦',
            'Lock': '🔒'
        };
        return emojis[name] || '•';
    }
}
//# sourceMappingURL=ConsoleReporter.js.map
/**
 * Console Reporter
 * Formats analysis results for terminal output
 */
import { FullReport } from '../types.js';
export declare class ConsoleReporter {
    format(report: FullReport): string;
    private formatSection;
    private getScoreColor;
    private getSeverityColor;
    private getEmoji;
}
//# sourceMappingURL=ConsoleReporter.d.ts.map
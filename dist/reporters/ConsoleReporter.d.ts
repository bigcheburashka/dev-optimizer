/**
 * Console Reporter
 * Formats analysis results for terminal output
 */
import { FullReport } from '../types.js';
export declare class ConsoleReporter {
    format(report: FullReport): string;
    private formatFinding;
    private formatFindingsList;
    private getScoreColor;
    private getSeverityColor;
    getExtension(): string;
}
//# sourceMappingURL=ConsoleReporter.d.ts.map
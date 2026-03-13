/**
 * npm Analyzer
 * Analyzes package.json for optimization opportunities
 */
import { Analyzer, AnalysisResult } from '../types.js';
export declare class NpmAnalyzer implements Analyzer {
    name: string;
    isApplicable(projectPath: string): Promise<boolean>;
    analyze(projectPath: string): Promise<AnalysisResult>;
    private readPackageJson;
    private collectMetrics;
    private getDirectorySize;
    private findDuplicates;
    private findLargePackages;
}
//# sourceMappingURL=NpmAnalyzer.d.ts.map
/**
 * Docker Analyzer
 * Analyzes Dockerfile for optimization opportunities
 */
import { Analyzer, AnalysisResult } from '../types.js';
export declare class DockerAnalyzer implements Analyzer {
    name: string;
    isApplicable(projectPath: string): Promise<boolean>;
    analyze(projectPath: string): Promise<AnalysisResult>;
    private readDockerfile;
    private checkDockerignore;
    private checkMultistage;
    private getBaseImage;
    private isAlpineBase;
    private countLayers;
    private checkCleanup;
    private calculateSavings;
    private calculateTimeSavings;
}
//# sourceMappingURL=DockerAnalyzer.d.ts.map
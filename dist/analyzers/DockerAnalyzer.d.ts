/**
 * Docker Analyzer
 * Analyzes Dockerfile for optimization opportunities
 * Returns unified Finding[] format
 */
import { Analyzer, AnalysisResult, Domain } from '../types.js';
export declare class DockerAnalyzer implements Analyzer {
    name: Domain;
    isApplicable(projectPath: string): Promise<boolean>;
    analyze(projectPath: string): Promise<AnalysisResult>;
    private collectBaseline;
    private calculateScore;
    private calculateSavings;
    private readDockerfile;
    private checkDockerignore;
    private hasMultistage;
    private getBaseImage;
    private isSmallBase;
    private hasCleanup;
    private countLayers;
}
//# sourceMappingURL=DockerAnalyzer.d.ts.map
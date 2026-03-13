/**
 * Docker Analyzer
 * Analyzes Dockerfile for optimization opportunities
 * Returns unified Finding[] format
 *
 * Modes:
 * - Quick: Static analysis only
 * - Full: + hadolint linting (requires hadolint)
 * - Deep: + image layer analysis (requires docker)
 */
import { Analyzer, AnalysisResult, Domain } from '../types.js';
export interface DockerAnalyzerOptions {
    mode?: 'quick' | 'full' | 'deep';
    runHadolint?: boolean;
}
export declare class DockerAnalyzer implements Analyzer {
    name: Domain;
    private options;
    constructor(options?: DockerAnalyzerOptions);
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
    /**
     * Check for layer optimization opportunities
     */
    private checkLayerOptimization;
    /**
     * Check for COPY vs ADD usage
     */
    private checkCopyVsAdd;
    /**
     * Check for workdir usage
     */
    private checkWorkdir;
    /**
     * Run hadolint for advanced Dockerfile linting
     * Full mode - requires hadolint binary
     */
    private runHadolint;
}
//# sourceMappingURL=DockerAnalyzer.d.ts.map
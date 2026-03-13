/**
 * Core types for dev-optimizer
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export interface Issue {
    type: string;
    severity: Severity;
    message: string;
    file?: string;
    line?: number;
    suggestion?: string;
    documentation?: string;
}
export interface Suggestion {
    type: string;
    description: string;
    impact: string;
    autoFix: boolean;
    safe: boolean;
}
export interface DockerMetrics {
    imageSize: number;
    buildTime: number;
    layerCount: number;
    contextSize: number;
}
export interface NpmMetrics {
    installTimeCold: number;
    installTimeCached: number;
    nodeModulesSize: number;
    totalDeps: number;
    unusedDeps: number;
    outdatedDeps: number;
}
export interface CiMetrics {
    totalTime: number;
    queueTime: number;
    cacheHitRate: number;
    parallelJobs: number;
}
export interface BundleMetrics {
    totalSize: number;
    gzipSize: number;
    brotliSize: number;
    chunkCount: number;
    unusedExports: number;
}
export interface SecurityMetrics {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    licenseIssues: number;
}
export interface Metrics {
    docker?: DockerMetrics;
    npm?: NpmMetrics;
    ci?: CiMetrics;
    bundle?: BundleMetrics;
    security?: SecurityMetrics;
}
export interface Savings {
    sizeMB: number;
    timeSeconds: number;
    percentImprovement: number;
}
export interface AnalysisResult {
    analyzer: string;
    score: number;
    issues: Issue[];
    suggestions: Suggestion[];
    metrics: Metrics;
    savings: Savings;
}
export interface FullReport {
    timestamp: string;
    path: string;
    docker?: AnalysisResult;
    npm?: AnalysisResult;
    ci?: AnalysisResult;
    bundle?: AnalysisResult;
    security?: AnalysisResult;
    overallScore: number;
    totalSavings: Savings;
}
export interface FixAction {
    type: string;
    file: string;
    description: string;
    safe: boolean;
    applied: boolean;
    error?: string;
}
export interface FixResult {
    timestamp: string;
    path: string;
    actions: FixAction[];
    totalApplied: number;
    totalSkipped: number;
    errors: string[];
}
export interface DevOptimizerConfig {
    path: string;
    analyzers: ('docker' | 'npm' | 'ci' | 'bundle' | 'security')[];
    output: 'console' | 'json' | 'markdown';
    safeOnly: boolean;
    dryRun: boolean;
}
export interface Analyzer {
    name: string;
    analyze(path: string): Promise<AnalysisResult>;
    isApplicable(path: string): Promise<boolean>;
}
export interface Fixer {
    name: string;
    canFix(issue: Issue): boolean;
    fix(issue: Issue, options: FixOptions): Promise<FixResult>;
    isSafe(issue: Issue): boolean;
}
export interface FixOptions {
    safeOnly: boolean;
    dryRun: boolean;
    backup: boolean;
}
export interface Reporter {
    format(report: FullReport): string;
    getExtension(): string;
}
//# sourceMappingURL=types.d.ts.map
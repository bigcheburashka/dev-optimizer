/**
 * Core types for dev-optimizer
 * Based on docs/finding-schema.md
 */
export type Domain = 'ci' | 'deps' | 'docker';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Confidence = 'high' | 'medium' | 'low';
export type ImpactType = 'time' | 'size' | 'cost';
export interface Evidence {
    file?: string;
    line?: number;
    snippet?: string;
    metrics?: Record<string, number>;
}
export interface Impact {
    type: ImpactType;
    estimate: string;
    confidence: Confidence;
}
export interface SuggestedFix {
    type: 'create' | 'modify' | 'delete';
    file: string;
    description: string;
    diff?: string;
    autoFixable: boolean;
}
export interface Finding {
    id: string;
    domain: Domain;
    title: string;
    description: string;
    evidence: Evidence;
    severity: Severity;
    confidence: Confidence;
    impact: Impact;
    suggestedFix: SuggestedFix;
    autoFixSafe: boolean;
}
export interface AnalysisResult {
    analyzer: Domain;
    score: number;
    findings: Finding[];
    baseline: Baseline;
    savings: Savings;
}
export interface Baseline {
    projectType: string;
    hasPackageJson: boolean;
    hasDockerfile: boolean;
    hasCi: boolean;
    dependencyCount: number;
    dockerImageSize?: number;
    ciTotalTime?: number;
    nodeModulesSizeMB?: number;
}
export interface Savings {
    timeSeconds: number;
    sizeMB: number;
    percentImprovement: number;
    monthlyCostEstimate?: number;
}
export interface FullReport {
    timestamp: string;
    path: string;
    version: string;
    baseline: Baseline;
    findings: Finding[];
    topFindings: Finding[];
    quickWins: Finding[];
    manualReview: Finding[];
    totalSavings: Savings;
    score: number;
}
export interface Analyzer {
    name: Domain;
    analyze(path: string): Promise<AnalysisResult>;
    isApplicable(path: string): Promise<boolean>;
}
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
export interface Fixer {
    name: string;
    canFix(finding: Finding): boolean;
    fix(finding: Finding, options: FixOptions): Promise<FixResult>;
    isSafe(finding: Finding): boolean;
}
export interface FixOptions {
    dryRun: boolean;
    backup: boolean;
    path: string;
}
export interface FixResult {
    findingId: string;
    applied: boolean;
    file: string;
    diff?: string;
    error?: string;
}
export interface Reporter {
    format(report: FullReport): string;
    getExtension(): string;
}
export interface DevOptimizerConfig {
    path: string;
    domains: Domain[];
    output: 'table' | 'json' | 'markdown';
    dryRun: boolean;
    safeOnly: boolean;
}
//# sourceMappingURL=types.d.ts.map
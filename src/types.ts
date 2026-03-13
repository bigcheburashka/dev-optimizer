/**
 * Core types for dev-optimizer
 */

// =============================================================================
// Issues and Suggestions
// =============================================================================

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

// =============================================================================
// Metrics
// =============================================================================

export interface DockerMetrics {
  imageSize: number; // MB
  buildTime: number; // seconds
  layerCount: number;
  contextSize: number; // MB
}

export interface NpmMetrics {
  installTimeCold: number; // seconds
  installTimeCached: number; // seconds
  nodeModulesSize: number; // MB
  totalDeps: number;
  unusedDeps: number;
  outdatedDeps: number;
}

export interface CiMetrics {
  totalTime: number; // seconds
  queueTime: number;
  cacheHitRate: number; // 0-1
  parallelJobs: number;
}

export interface BundleMetrics {
  totalSize: number; // KB
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

// =============================================================================
// Savings
// =============================================================================

export interface Savings {
  sizeMB: number;
  timeSeconds: number;
  percentImprovement: number;
}

// =============================================================================
// Analysis Results
// =============================================================================

export interface AnalysisResult {
  analyzer: string;
  score: number; // 0-100
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

// =============================================================================
// Fix Results
// =============================================================================

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

// =============================================================================
// Config
// =============================================================================

export interface DevOptimizerConfig {
  path: string;
  analyzers: ('docker' | 'npm' | 'ci' | 'bundle' | 'security')[];
  output: 'console' | 'json' | 'markdown';
  safeOnly: boolean;
  dryRun: boolean;
}

// =============================================================================
// Analyzer Interface
// =============================================================================

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

// =============================================================================
// Reporter Interface
// =============================================================================

export interface Reporter {
  format(report: FullReport): string;
  getExtension(): string;
}
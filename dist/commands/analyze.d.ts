/**
 * Analyze command
 * Unified analysis with Finding schema
 */
interface AnalyzeOptions {
    path: string;
    output: 'table' | 'json' | 'markdown';
    type: 'docker' | 'deps' | 'ci' | 'all';
    top: number;
    quick?: boolean;
    deep?: boolean;
    verbose?: boolean;
    quiet?: boolean;
}
export declare function analyzeCommand(options: AnalyzeOptions): Promise<void>;
export {};
//# sourceMappingURL=analyze.d.ts.map
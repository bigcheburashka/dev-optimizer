/**
 * Analyze command
 */
interface AnalyzeOptions {
    path: string;
    output: 'console' | 'json' | 'markdown';
    type: 'docker' | 'npm' | 'ci' | 'all';
}
export declare function analyzeCommand(options: AnalyzeOptions): Promise<void>;
export {};
//# sourceMappingURL=analyze.d.ts.map
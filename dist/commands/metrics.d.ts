/**
 * Metrics command
 * Collect and compare metrics
 */
interface MetricsOptions {
    path: string;
    baseline: boolean;
    compare: boolean;
}
export declare function metricsCommand(options: MetricsOptions): Promise<void>;
export {};
//# sourceMappingURL=metrics.d.ts.map
/**
 * Fix command
 * Apply safe optimizations automatically
 */
interface FixOptions {
    path: string;
    dryRun: boolean;
    safe: boolean;
    domain?: 'docker' | 'deps' | 'ci' | 'all';
}
export declare function fixCommand(options: FixOptions): Promise<void>;
export {};
//# sourceMappingURL=fix.d.ts.map
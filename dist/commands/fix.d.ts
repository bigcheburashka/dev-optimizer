/**
 * Fix command
 * Apply safe optimizations automatically
 */
interface FixOptions {
    path: string;
    safe: boolean;
    dryRun: boolean;
}
export declare function fixCommand(options: FixOptions): Promise<void>;
export {};
//# sourceMappingURL=fix.d.ts.map
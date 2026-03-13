/**
 * Fix command
 * Apply safe optimizations automatically
 */
import { FixOptions } from '../types.js';
interface FixOptionsExtended extends FixOptions {
    safe?: boolean;
}
export declare function fixCommand(options: FixOptionsExtended): Promise<void>;
export {};
//# sourceMappingURL=fix.d.ts.map
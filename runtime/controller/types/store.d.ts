import type { RemoteTarget } from './types.ts';
/** Reject extra fields so callers cannot persist credentials in a target record. */
export declare function parseTarget(value: unknown): RemoteTarget;
/** Owns only non-sensitive target JSON beneath the current DSH home. */
export declare class TargetStore {
    private readonly file;
    constructor(file: string);
    /** @returns validated records from the current file. */
    list(): Promise<RemoteTarget[]>;
    /** @param value - full validated replacement target. @returns saved records. */
    save(value: unknown): Promise<RemoteTarget[]>;
}
//# sourceMappingURL=store.d.ts.map
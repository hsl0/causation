interface CausationChainingMethod {
    (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]): Causation;
}
interface CausationResultMethod {
    (): Promise<unknown>;
}
interface DeferCombination {
    wait: CausationChainingMethod;
    must: CausationChainingMethod;
}
interface WaitCombination {
    defer: CausationChainingMethod;
    chain: CausationChainingMethod;
}
type DeferMethod = CausationChainingMethod & DeferCombination & CausationResultMethod;
type ChainMethod = CausationChainingMethod & DeferCombination & CausationResultMethod;
type WaitMethod = CausationChainingMethod & WaitCombination;
type MustMethod = CausationChainingMethod & WaitCombination;
declare class Causation {
    #private;
    constructor(functions: ((...args: unknown[]) => unknown)[], results?: Promise<unknown>[], awaiting?: Promise<unknown> | null);
    and(...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]): Causation;
    defer: DeferMethod;
    chain: ChainMethod;
    must: MustMethod;
    wait: WaitMethod;
}
export declare function exec(...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]): Causation;
export {};
//# sourceMappingURL=exec.d.ts.map
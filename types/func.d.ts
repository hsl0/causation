export declare const CAUSATION_FUNCTION: unique symbol;
export declare const DEFER_FUNCTION: unique symbol;
export declare const WAIT_FUNCTION: unique symbol;
export declare const CHAIN_FUNCTION: unique symbol;
export declare const MUST_FUNCTION: unique symbol;
export type CausationFunction<F extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown> = F & {
    [CAUSATION_FUNCTION]: true;
    [DEFER_FUNCTION]?: boolean;
    [WAIT_FUNCTION]?: boolean;
    [CHAIN_FUNCTION]?: boolean;
    [MUST_FUNCTION]?: boolean;
};
export declare function wrap<F extends (...args: unknown[]) => unknown>(func: F | CausationFunction<F>): CausationFunction<F>;
export declare function defer<F extends (...args: unknown[]) => unknown | Promise<unknown>>(func: F): CausationFunction<F>;
export declare namespace defer {
    var _a: (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) => CausationFunction<CausationFunction<(...args: unknown[]) => unknown>>;
    export { _a as wait };
    export var _b: (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) => CausationFunction<CausationFunction<(...args: unknown[]) => unknown>>;
    export { _b as must };
}
export declare function defer(...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]): CausationFunction<(...args: unknown[]) => unknown>;
export declare function wait<F extends (...args: unknown[]) => unknown | Promise<unknown>>(func: F): CausationFunction<F>;
export declare namespace wait {
    var _c: (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) => CausationFunction<CausationFunction<(...args: unknown[]) => unknown>>;
    export { _c as defer };
    export var _d: (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) => CausationFunction<CausationFunction<(...args: unknown[]) => unknown>>;
    export { _d as chain };
}
export declare function wait(...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]): CausationFunction<(...args: unknown[]) => unknown>;
export declare function chain<F extends (...args: unknown[]) => unknown | Promise<unknown>>(func: F): CausationFunction<F>;
export declare namespace chain {
    var _e: (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) => CausationFunction<CausationFunction<(...args: unknown[]) => unknown>>;
    export { _e as wait };
    export var _f: (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) => CausationFunction<CausationFunction<(...args: unknown[]) => unknown>>;
    export { _f as must };
}
export declare function chain(...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]): CausationFunction<(...args: unknown[]) => unknown>;
export declare function must<F extends (...args: unknown[]) => unknown | Promise<unknown>>(func: F): CausationFunction<F>;
export declare namespace must {
    var _g: (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) => CausationFunction<CausationFunction<(...args: unknown[]) => unknown>>;
    export { _g as defer };
    export var _h: (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) => CausationFunction<CausationFunction<(...args: unknown[]) => unknown>>;
    export { _h as chain };
}
export declare function must(...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]): CausationFunction<(...args: unknown[]) => unknown>;
//# sourceMappingURL=func.d.ts.map
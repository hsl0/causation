import { exec } from './exec.js';

export const CAUSATION_FUNCTION = Symbol('CausationFunction instance');
export const DEFER_FUNCTION = Symbol('defer function');
export const WAIT_FUNCTION = Symbol('wait function');
export const CHAIN_FUNCTION = Symbol('chain function');
export const MUST_FUNCTION = Symbol('must function');

export type CausationFunction<
	F extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown,
> = F & {
	[CAUSATION_FUNCTION]: true;
	[DEFER_FUNCTION]?: boolean;
	[WAIT_FUNCTION]?: boolean;
	[CHAIN_FUNCTION]?: boolean;
	[MUST_FUNCTION]?: boolean;
};

export function wrap<F extends (...args: unknown[]) => unknown>(
	func: F | CausationFunction<F>
): CausationFunction<F> {
	if (typeof func !== 'function') throw new TypeError(`${func} is not function`);

	if ((func as CausationFunction<F>)[CAUSATION_FUNCTION])
		return func as CausationFunction<F>;

	const wrapped = (...args: Parameters<F>) => func(...args);
	wrapped[CAUSATION_FUNCTION] = true;
	return wrapped as CausationFunction<F>;
}

export function defer<F extends (...args: unknown[]) => unknown | Promise<unknown>>(
	func: F
): CausationFunction<F>;
export function defer(
	...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
): CausationFunction<(...args: unknown[]) => unknown>;
export function defer(
	...functions: ((...args: unknown[]) => unknown)[]
): CausationFunction<(...args: unknown[]) => unknown> {
	if (functions.length === 1) {
		const wrapped = wrap(functions[0]!);
		wrapped[DEFER_FUNCTION] = true;
		return wrapped;
	} else if (functions.length <= 0) {
		throw new TypeError('Functions must be provided');
	}
	return defer(() => exec(...functions).chain());
}

defer.wait = (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) =>
	wait(defer(...functions));
defer.must = (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) =>
	must(defer(...functions));

export function wait<F extends (...args: unknown[]) => unknown | Promise<unknown>>(
	func: F
): CausationFunction<F>;
export function wait(
	...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
): CausationFunction<(...args: unknown[]) => unknown>;
export function wait(
	...functions: ((...args: unknown[]) => unknown)[]
): CausationFunction<(...args: unknown[]) => unknown> {
	if (functions.length === 1) {
		const wrapped = wrap(functions[0]!);
		wrapped[WAIT_FUNCTION] = true;
		return wrapped;
	} else if (functions.length <= 0) {
		throw new TypeError('Functions must be provided');
	}
	return wait(() => exec(...functions).chain());
}

wait.defer = (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) =>
	defer(wait(...functions));
wait.chain = (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) =>
	chain(wait(...functions));

export function chain<F extends (...args: unknown[]) => unknown | Promise<unknown>>(
	func: F
): CausationFunction<F>;
export function chain(
	...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
): CausationFunction<(...args: unknown[]) => unknown>;
export function chain(
	...functions: ((...args: unknown[]) => unknown)[]
): CausationFunction<(...args: unknown[]) => unknown> {
	if (functions.length === 1) {
		const wrapped = wrap(functions[0]!);
		wrapped[CHAIN_FUNCTION] = true;
		return wrapped;
	} else if (functions.length <= 0) {
		throw new TypeError('Functions must be provided');
	}
	return chain(() => exec(...functions).chain());
}

chain.wait = (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) =>
	wait(chain(...functions));
chain.must = (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) =>
	must(chain(...functions));

export function must<F extends (...args: unknown[]) => unknown | Promise<unknown>>(
	func: F
): CausationFunction<F>;
export function must(
	...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
): CausationFunction<(...args: unknown[]) => unknown>;
export function must(
	...functions: ((...args: unknown[]) => unknown)[]
): CausationFunction<(...args: unknown[]) => unknown> {
	if (functions.length === 1) {
		const wrapped = wrap(functions[0]!);
		wrapped[MUST_FUNCTION] = true;
		return wrapped;
	} else if (functions.length <= 0) {
		throw new TypeError('Functions must be provided');
	}
	return must(() => exec(...functions).chain());
}

must.defer = (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) =>
	defer(must(...functions));
must.chain = (...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]) =>
	chain(must(...functions));

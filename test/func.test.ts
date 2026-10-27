import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exec } from '../src/exec.js';
import {
	CAUSATION_FUNCTION,
	CHAIN_FUNCTION,
	DEFER_FUNCTION,
	MUST_FUNCTION,
	WAIT_FUNCTION,
	chain,
	defer,
	must,
	wait,
	wrap,
} from '../src/func.js';

vi.mock('../src/exec.js', () => ({ exec: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const wrappers = [
	{ name: 'defer', decorate: defer, symbol: DEFER_FUNCTION },
	{ name: 'wait', decorate: wait, symbol: WAIT_FUNCTION },
	{ name: 'chain', decorate: chain, symbol: CHAIN_FUNCTION },
	{ name: 'must', decorate: must, symbol: MUST_FUNCTION },
];

const combinations = [
	{
		name: 'defer.wait',
		decorate: defer.wait,
		symbols: [DEFER_FUNCTION, WAIT_FUNCTION],
	},
	{
		name: 'defer.must',
		decorate: defer.must,
		symbols: [DEFER_FUNCTION, MUST_FUNCTION],
	},
	{
		name: 'chain.wait',
		decorate: chain.wait,
		symbols: [CHAIN_FUNCTION, WAIT_FUNCTION],
	},
	{
		name: 'chain.must',
		decorate: chain.must,
		symbols: [CHAIN_FUNCTION, MUST_FUNCTION],
	},
	{
		name: 'wait.defer',
		decorate: wait.defer,
		symbols: [WAIT_FUNCTION, DEFER_FUNCTION],
	},
	{
		name: 'wait.chain',
		decorate: wait.chain,
		symbols: [WAIT_FUNCTION, CHAIN_FUNCTION],
	},
	{
		name: 'must.defer',
		decorate: must.defer,
		symbols: [MUST_FUNCTION, DEFER_FUNCTION],
	},
	{
		name: 'must.chain',
		decorate: must.chain,
		symbols: [MUST_FUNCTION, CHAIN_FUNCTION],
	},
];

describe.each([
	{ name: 'wrap', decorate: wrap, symbol: CAUSATION_FUNCTION },
	...wrappers,
])('$name()', ({ decorate, symbol }) => {
	it.each([undefined, null, false, 0, 'function', {}, []])(
		'throws TypeError for non-function input %j',
		(value) => {
			expect(() => decorate(value as never)).toThrow(TypeError);
		}
	);

	it('returns an already marked function unchanged', () => {
		const marked = decorate(vi.fn());
		expect(decorate(marked)).toBe(marked);
	});

	it('creates a new function that forwards arguments and results without modifying the original', () => {
		const result = {};
		const original = vi.fn((..._args: unknown[]) => result);
		const originalSymbols = Object.getOwnPropertySymbols(original);
		const wrapped = decorate(original);
		const argument = {};
		expect(wrapped).not.toBe(original);
		expect(original).not.toHaveBeenCalled();
		expect(wrapped('value', argument)).toBe(result);
		expect(original).toHaveBeenCalledExactlyOnceWith('value', argument);
		expect(wrapped[CAUSATION_FUNCTION]).toBe(true);
		expect(Reflect.get(wrapped, symbol)).toBe(true);
		expect(Object.getOwnPropertySymbols(original)).toEqual(originalSymbols);
	});

	it('returns the original promise unchanged', async () => {
		const promise = Promise.resolve('result');
		expect(decorate(() => promise)()).toBe(promise);
		await promise;
	});

	it('propagates the original synchronous error', () => {
		const error = new Error('failure');
		expect(
			decorate(() => {
				throw error;
			})
		).toThrow(error);
	});
});

describe.each(wrappers)('$name() with multiple functions', ({ decorate, symbol }) => {
	it('throws TypeError when no functions are provided', () => {
		expect(() => decorate()).toThrow(TypeError);
	});

	it('passes all functions to exec when called and returns its completion promise', async () => {
		const first = vi.fn();
		const second = vi.fn();
		const promise = Promise.resolve(['first', 'second']);
		const collect = vi.fn(() => promise);
		vi.mocked(exec).mockReturnValue({ chain: collect } as unknown as ReturnType<
			typeof exec
		>);
		const wrapped = decorate(first, second);
		expect(exec).not.toHaveBeenCalled();
		expect(wrapped[CAUSATION_FUNCTION]).toBe(true);
		expect(Reflect.get(wrapped, symbol)).toBe(true);
		expect(wrapped()).toBe(promise);
		expect(exec).toHaveBeenCalledExactlyOnceWith(first, second);
		expect(collect).toHaveBeenCalledExactlyOnceWith();
		await expect(promise).resolves.toEqual(['first', 'second']);
	});
});

describe.each(combinations)('$name()', ({ decorate, symbols }) => {
	it('sets both keyword symbols and calls the original function', () => {
		const original = vi.fn((...args: unknown[]) => args);
		const wrapped = decorate(original);
		expect(wrapped[CAUSATION_FUNCTION]).toBe(true);
		for (const symbol of symbols) expect(Reflect.get(wrapped, symbol)).toBe(true);
		expect(wrapped('argument')).toEqual(['argument']);
		expect(original).toHaveBeenCalledExactlyOnceWith('argument');
	});

	it('sets both symbols on a function that runs multiple functions through exec', async () => {
		const functions = [vi.fn(), vi.fn()];
		const promise = Promise.resolve(['done']);
		const collect = vi.fn(() => promise);
		vi.mocked(exec).mockReturnValue({ chain: collect } as unknown as ReturnType<
			typeof exec
		>);
		const wrapped = decorate(...functions);
		for (const symbol of symbols) expect(Reflect.get(wrapped, symbol)).toBe(true);
		expect(wrapped()).toBe(promise);
		expect(exec).toHaveBeenCalledExactlyOnceWith(...functions);
		expect(collect).toHaveBeenCalledOnce();
		await promise;
	});
});

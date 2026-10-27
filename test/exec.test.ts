import { describe, expect, it, vi } from 'vitest';
import { Causation, exec } from '../src/exec.js';
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
} from '../src/func.js';

function pending() {
	return Promise.withResolvers<unknown>();
}

async function flush() {
	for (let index = 0; index < 10; index++) await Promise.resolve();
}

describe('exec() and the Causation constructor', () => {
	it('returns a Causation instance and calls all input functions in order', async () => {
		const calls: number[] = [];
		const result = exec(
			() => calls.push(1),
			() => calls.push(2),
			() => calls.push(3)
		);
		expect(result).toBeInstanceOf(Causation);
		expect(calls).toEqual([1, 2, 3]);
		await expect(result.chain()).resolves.toEqual([1, 2, 3]);
	});

	it('returns empty results when no functions are provided', async () => {
		await expect(exec().chain()).resolves.toEqual([]);
	});

	it('retains existing results passed to the constructor alongside new results', async () => {
		const results = [Promise.resolve('previous')];
		const next = vi.fn(() => 'next');
		const result = new Causation([next], results);
		expect(next).toHaveBeenCalledExactlyOnceWith();
		expect(results).toHaveLength(2);
		await expect(result.chain()).resolves.toEqual(['previous', 'next']);
	});

	it('runs input functions after the promise passed to the constructor fulfills', async () => {
		const gate = pending();
		const next = vi.fn();
		new Causation([next], [], gate.promise);
		expect(next).not.toHaveBeenCalled();
		gate.resolve(undefined);
		await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
	});
});

describe.each(['settled', 'pending'] as const)(
	'constructor awaiting: %s promise',
	(state) => {
		it.each(['resolve', 'reject'] as const)(
			'%s: resumes execution only on fulfillment without repeated waiting',
			async (outcome) => {
				const error = new Error('awaiting failure');
				const awaiting =
					state === 'settled'
						? outcome === 'resolve'
							? Promise.resolve()
							: Promise.reject(error)
						: new Promise<void>((resolve, reject) => {
								queueMicrotask(() =>
									outcome === 'resolve' ? resolve() : reject(error)
								);
							});
				const originalThen = awaiting.then.bind(awaiting);
				const unhandled: unknown[] = [];
				let subscriptions = 0;
				let loopDetected = false;
				// Limit subscriptions because an infinite microtask loop would also block Vitest timers.
				const then = vi.spyOn(awaiting, 'then').mockImplementation(((
					...args: Parameters<typeof awaiting.then>
				) => {
					if (++subscriptions > 32) {
						loopDetected = true;
						return new Promise(() => {});
					}
					const result = originalThen(...args);
					// Report rejections from promises discarded by the constructor as test failures.
					void result.catch((reason) => {
						unhandled.push(reason);
					});
					return result;
				}) as typeof awaiting.then);

				try {
					const first = vi.fn();
					const second = vi.fn();
					const result = new Causation([first], [], awaiting);
					const child = result.and(second);
					expect(first).not.toHaveBeenCalled();
					expect(second).not.toHaveBeenCalled();

					await new Promise((resolve) => setTimeout(resolve, 0));
					expect(loopDetected).toBe(false);
					expect(first).toHaveBeenCalledTimes(outcome === 'resolve' ? 1 : 0);
					expect(second).toHaveBeenCalledTimes(outcome === 'resolve' ? 1 : 0);

					const afterParent = vi.fn();
					const afterChild = vi.fn();
					result.and(afterParent);
					child.and(afterChild);
					// Synchronous execution after fulfillment verifies that each instance has cleared #awaiting.
					expect(afterParent).toHaveBeenCalledTimes(
						outcome === 'resolve' ? 1 : 0
					);
					expect(afterChild).toHaveBeenCalledTimes(
						outcome === 'resolve' ? 1 : 0
					);
					await new Promise((resolve) => setTimeout(resolve, 0));
					expect(loopDetected).toBe(false);
					expect(afterParent).toHaveBeenCalledTimes(
						outcome === 'resolve' ? 1 : 0
					);
					expect(afterChild).toHaveBeenCalledTimes(
						outcome === 'resolve' ? 1 : 0
					);

					const settledSubscriptions = subscriptions;
					await new Promise((resolve) => setTimeout(resolve, 0));
					expect(subscriptions).toBe(settledSubscriptions);
					expect(first).toHaveBeenCalledTimes(outcome === 'resolve' ? 1 : 0);
					expect(second).toHaveBeenCalledTimes(outcome === 'resolve' ? 1 : 0);
					expect(unhandled).toEqual([]);
				} finally {
					then.mockRestore();
				}
			}
		);
	}
);

describe('plain function execution', () => {
	it('runs the next function without waiting for previous asynchronous tasks', async () => {
		const gate = pending();
		const next = vi.fn(() => 'next');
		const result = exec(() => gate.promise, next);
		expect(next).toHaveBeenCalledOnce();
		gate.resolve('first');
		await expect(result.chain()).resolves.toEqual(['first', 'next']);
	});

	it.each(['sync', 'async'])(
		'runs the next function despite a %s error',
		async (kind) => {
			const error = new Error('failure');
			const next = vi.fn();
			const result = exec(() => {
				if (kind === 'sync') throw error;
				return Promise.reject(error);
			}, next);
			await expect(result.chain()).rejects.toBe(error);
			expect(next).toHaveBeenCalledOnce();
		}
	);
});

describe.each([
	{ name: 'defer', decorate: defer, skips: false },
	{ name: 'chain', decorate: chain, skips: true },
])('functions wrapped with $name()', ({ decorate, skips }) => {
	it('waits for all previous tasks to settle', async () => {
		const first = pending();
		const second = pending();
		const wrapped = vi.fn(() => 'wrapped');
		const result = exec(
			() => first.promise,
			() => second.promise,
			decorate(wrapped)
		);
		const completion = result.chain();
		expect(wrapped).not.toHaveBeenCalled();
		first.resolve('first');
		await flush();
		expect(wrapped).not.toHaveBeenCalled();
		second.resolve('second');
		await expect(completion).resolves.toEqual(['first', 'second', 'wrapped']);
		expect(wrapped).toHaveBeenCalledOnce();
	});

	it('allows the next plain function to run before its asynchronous task settles', async () => {
		const gate = pending();
		const wrapped = vi.fn(() => gate.promise);
		const next = vi.fn();
		const result = exec(decorate(wrapped), next);
		expect(next).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(wrapped).toHaveBeenCalledOnce());
		gate.resolve(undefined);
		await result.chain();
	});

	it('allows the next plain function to run even if it fails', async () => {
		const error = new Error('wrapped failure');
		const next = vi.fn();
		const result = exec(
			decorate(() => Promise.reject(error)),
			next
		);
		await expect(result.chain()).rejects.toBe(error);
		expect(next).toHaveBeenCalledOnce();
	});

	it('runs or skips the function based on previous task failures', async () => {
		const error = new Error('previous failure');
		const wrapped = vi.fn();
		const result = exec(() => Promise.reject(error), decorate(wrapped));
		await expect(result.chain()).rejects.toBe(error);
		expect(wrapped).toHaveBeenCalledTimes(skips ? 0 : 1);
	});
});

describe.each([
	{ name: 'wait', decorate: wait, stops: false },
	{ name: 'must', decorate: must, stops: true },
])('functions wrapped with $name()', ({ decorate, stops }) => {
	it('runs all subsequent functions only after its asynchronous task settles', async () => {
		const gate = pending();
		const first = vi.fn();
		const second = vi.fn();
		const result = exec(
			decorate(() => gate.promise),
			first,
			second
		);
		expect(first).not.toHaveBeenCalled();
		expect(second).not.toHaveBeenCalled();
		gate.resolve(undefined);
		await vi.waitFor(() => {
			expect(first).toHaveBeenCalledOnce();
			expect(second).toHaveBeenCalledOnce();
		});
		await result.chain();
	});

	it('does not wait for previous tasks to settle', async () => {
		const gate = pending();
		const wrapped = vi.fn();
		const result = exec(() => gate.promise, decorate(wrapped));
		expect(wrapped).toHaveBeenCalledOnce();
		gate.resolve(undefined);
		await result.chain();
	});

	it('runs even if a previous task fails', async () => {
		const error = new Error('previous failure');
		const wrapped = vi.fn();
		const result = exec(() => Promise.reject(error), decorate(wrapped));
		await expect(result.chain()).rejects.toBe(error);
		expect(wrapped).toHaveBeenCalledOnce();
	});

	it.each(['sync', 'async'])(
		'continues or stops subsequent execution after its own %s failure',
		async (kind) => {
			const error = new Error('wrapped failure');
			const next = vi.fn();
			const result = exec(
				decorate(() => {
					if (kind === 'sync') throw error;
					return Promise.reject(error);
				}),
				next
			);
			await expect(result.chain()).rejects.toBe(error);
			await flush();
			expect(next).toHaveBeenCalledTimes(stops ? 0 : 1);
		}
	);
});

describe.each([
	{ name: 'defer.wait', decorate: defer.wait, skips: false, stops: false },
	{ name: 'defer.must', decorate: defer.must, skips: false, stops: true },
	{ name: 'chain.wait', decorate: chain.wait, skips: true, stops: false },
	{ name: 'chain.must', decorate: chain.must, skips: true, stops: true },
])('$name() combination', ({ decorate, skips, stops }) => {
	it('waits for the previous task, then the combined function, before running the next function', async () => {
		const previous = pending();
		const current = pending();
		const wrapped = vi.fn(() => current.promise);
		const next = vi.fn();
		const result = exec(() => previous.promise, decorate(wrapped), next);
		expect(wrapped).not.toHaveBeenCalled();
		expect(next).not.toHaveBeenCalled();
		previous.resolve(undefined);
		await vi.waitFor(() => expect(wrapped).toHaveBeenCalledOnce());
		expect(next).not.toHaveBeenCalled();
		current.resolve(undefined);
		await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
		await result.chain();
	});

	it('runs or blocks the next function based on the combined function failure policy', async () => {
		const error = new Error('current failure');
		const next = vi.fn();
		const result = exec(
			decorate(() => Promise.reject(error)),
			next
		);
		await expect(result.chain()).rejects.toBe(error);
		await flush();
		expect(next).toHaveBeenCalledTimes(stops ? 0 : 1);
	});

	it('runs or skips the combined function based on previous task failures', async () => {
		const error = new Error('previous failure');
		const wrapped = vi.fn();
		const result = exec(() => Promise.reject(error), decorate(wrapped));
		await expect(result.chain()).rejects.toBe(error);
		expect(wrapped).toHaveBeenCalledTimes(skips ? 0 : 1);
	});
});

describe.each(['chain', 'defer'] as const)('%s() result collection', (method) => {
	it.each(['sync', 'async'])('rejects with the original %s error', async (kind) => {
		const error = new Error('failure');
		const result = exec(() => {
			if (kind === 'sync') throw error;
			return Promise.reject(error);
		});
		await expect(result[method]()).rejects.toBe(error);
	});

	it('returns successful results in input order regardless of completion order', async () => {
		const gate = pending();
		const result = exec(
			() => gate.promise,
			() => 'second'
		);
		const completion = result[method]();
		gate.resolve('first');
		await expect(completion).resolves.toEqual(['first', 'second']);
	});
});

it('chain() waits for all started tasks to settle before rejecting on failure', async () => {
	const gate = pending();
	const error = new Error('failure');
	const settled = vi.fn();
	const completion = exec(
		() => Promise.reject(error),
		() => gate.promise
	).chain() as unknown as Promise<unknown>;
	const observed = completion.then(settled, settled);
	try {
		await flush();
		expect(settled).not.toHaveBeenCalled();
		gate.resolve(undefined);
		await expect(completion).rejects.toBe(error);
		await observed;
		expect(settled).toHaveBeenCalledExactlyOnceWith(error);
	} finally {
		gate.resolve(undefined);
	}
});

it('defer() waits for all tasks to settle before rejecting on failure', async () => {
	const gate = pending();
	const error = new Error('failure');
	const settled = vi.fn();
	const completion = exec(
		() => Promise.reject(error),
		() => gate.promise
	).defer() as unknown as Promise<unknown>;
	const observed = completion.then(settled, settled);
	await flush();
	expect(settled).not.toHaveBeenCalled();
	gate.resolve(undefined);
	await expect(completion).rejects.toBe(error);
	await observed;
	expect(settled).toHaveBeenCalledExactlyOnceWith(error);
});

describe('and()', () => {
	it.each([1, 2])(
		'runs %i functions and returns a new instance sharing existing results',
		async (count) => {
			const gate = pending();
			const original = exec(() => gate.promise);
			const functions = Array.from({ length: count }, (_, index) =>
				vi.fn(() => index)
			);
			const next = original.and(...functions);
			expect(next).not.toBe(original);
			expect(next.constructor).toBe(original.constructor);
			for (const func of functions) expect(func).toHaveBeenCalledExactlyOnceWith();
			gate.resolve('previous');
			const expected = ['previous', ...functions.map((_, index) => index)];
			await expect(next.chain()).resolves.toEqual(expected);
			await expect(original.chain()).resolves.toEqual(expected);
		}
	);
});

const keywords = {
	defer: DEFER_FUNCTION,
	chain: CHAIN_FUNCTION,
	wait: WAIT_FUNCTION,
	must: MUST_FUNCTION,
};
const methods = [
	['defer'],
	['chain'],
	['wait'],
	['must'],
	['defer', 'wait'],
	['defer', 'must'],
	['chain', 'wait'],
	['chain', 'must'],
	['wait', 'defer'],
	['wait', 'chain'],
	['must', 'defer'],
	['must', 'chain'],
] as const;

describe.each(methods.map((path) => ({ name: path.join('.'), path })))(
	'Causation.$name()',
	({ path }) => {
		it('passes a function with the keyword symbols to and()', () => {
			const causation = exec();
			const and = vi.spyOn(causation, 'and').mockReturnValue(causation);
			const original = vi.fn(() => 'result');
			const [first, second] = path;
			const owner = second ? causation[first] : causation;
			const method = second ? Reflect.get(owner, second) : causation[first];
			expect(Reflect.apply(method, owner, [original])).toBe(causation);
			expect(and).toHaveBeenCalledOnce();
			const wrapped = and.mock.calls[0]![0]!;
			expect(Reflect.get(wrapped, CAUSATION_FUNCTION)).toBe(true);
			for (const keyword of path)
				expect(Reflect.get(wrapped, keywords[keyword])).toBe(true);
			expect(wrapped()).toBe('result');
			expect(original).toHaveBeenCalledOnce();
		});
	}
);

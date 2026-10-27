import {
	defer,
	wait,
	chain,
	must,
	DEFER_FUNCTION,
	CHAIN_FUNCTION,
	MUST_FUNCTION,
	WAIT_FUNCTION,
} from './func.js';
import type { CausationFunction } from './func.js';

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

export class Causation {
	#results: Promise<unknown>[];
	#awaiting: Promise<unknown> | null;

	constructor(
		functions: ((...args: unknown[]) => unknown)[],
		results: Promise<unknown>[] = [],
		awaiting: Promise<unknown> | null = null
	) {
		this.#results = results;
		this.#awaiting = awaiting;
		this.#exec(functions);

		this.defer = Object.assign(this.defer.bind(this), {
			wait: this.defer.wait.bind(this),
			must: this.defer.must.bind(this),
		});

		this.chain = Object.assign(this.chain.bind(this), {
			wait: this.chain.wait.bind(this),
			must: this.chain.must.bind(this),
		});

		this.must = Object.assign(this.must.bind(this), {
			defer: this.must.defer.bind(this),
			chain: this.must.chain.bind(this),
		});

		this.wait = Object.assign(this.wait.bind(this), {
			defer: this.wait.defer.bind(this),
			chain: this.wait.chain.bind(this),
		});

		if (this.#awaiting) {
			this.#awaiting.then(
				() => {
					this.#awaiting = null;
				},
				() => {}
			);
		}
	}

	#exec(functions: ((...args: unknown[]) => unknown)[]): void {
		if (this.#awaiting) {
			this.#awaiting.then(
				() => this.#exec(functions),
				() => !this.#awaiting && this.#exec(functions)
			);
			return;
		}

		while (functions.length > 0) {
			if (this.#awaiting) {
				return;
			}
			const func = functions.shift()!;
			try {
				const result =
					(func as CausationFunction)[DEFER_FUNCTION] ||
					(func as CausationFunction)[CHAIN_FUNCTION]
						? ((func as CausationFunction)[CHAIN_FUNCTION]
								? Promise.all(this.#results)
								: Promise.allSettled(this.#results)
							).then(() => func())
						: Promise.resolve(func());
				if ((func as CausationFunction)[MUST_FUNCTION]) {
					this.#awaiting = result.then(() => {
						this.#awaiting = null;
						this.#exec(functions);
					});
				} else if ((func as CausationFunction)[WAIT_FUNCTION]) {
					this.#awaiting = result.finally(() => {
						this.#awaiting = null;
						this.#exec(functions);
					});
				}
				this.#results.push(result);
			} catch (error) {
				if ((func as CausationFunction)[MUST_FUNCTION]) {
					this.#awaiting = Promise.reject(error);
				}
				this.#results.push(Promise.reject(error));
			}
		}
	}

	and(...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]): Causation {
		return new Causation(functions, this.#results, this.#awaiting);
	}

	declare defer: DeferMethod;
	declare chain: ChainMethod;
	declare must: MustMethod;
	declare wait: WaitMethod;

	static {
		Causation.prototype.defer = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation | Promise<unknown> {
			if (functions.length === 0) {
				const result = Promise.all(this.#results);
				return Promise.allSettled(this.#results).then(() => result);
			} else {
				return this.and(defer(...functions));
			}
		} as DeferMethod;

		Causation.prototype.defer.wait = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(defer.wait(...functions));
		};

		Causation.prototype.defer.must = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(defer.must(...functions));
		};

		Causation.prototype.chain = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation | Promise<unknown> {
			if (functions.length === 0) {
				const result = Promise.all(this.#results);
				return Promise.allSettled(this.#results).then(() => result);
			} else {
				return this.and(chain(...functions));
			}
		} as ChainMethod;

		Causation.prototype.chain.wait = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(chain.wait(...functions));
		};

		Causation.prototype.chain.must = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(chain.must(...functions));
		};

		Causation.prototype.must = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(must(...functions));
		} as MustMethod;

		Causation.prototype.must.defer = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(must.defer(...functions));
		};

		Causation.prototype.must.chain = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(must.chain(...functions));
		};

		Causation.prototype.wait = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(wait(...functions));
		} as WaitMethod;

		Causation.prototype.wait.defer = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(wait.defer(...functions));
		};

		Causation.prototype.wait.chain = function (
			this: Causation,
			...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
		): Causation {
			return this.and(wait.chain(...functions));
		};
	}
}

export function exec(
	...functions: ((...args: unknown[]) => unknown | Promise<unknown>)[]
): Causation {
	return new Causation(functions);
}

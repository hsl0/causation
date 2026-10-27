# causation

## Installation

```sh
npm install causation
```

## Usage

Input:
```js
import { exec, defer, wait } from 'causation';

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

await exec(
	() => console.log('first'),
	async () => {
		console.log('second started');
		await sleep(500);
		console.log('\nsecond done');
	},
	() => console.log('third'),
	defer(() => console.log('deferred forth')),
	() => console.log('fifth'),
	wait(async () => {
		console.log('sixth started');
		await sleep(1000);
		console.log('\nsixth done');
	}),
	() => console.log('seventh')
).defer();
```

Output:
```
first
second started
third
fifth
sixth started

second done
deferred forth

sixth done
seventh
```

`exec()` executes each functions sequentially; however, you can modify this behavior with utility functions.

`defer()` makes the function to wait async jobs done from previous functions. `chain()` is similar, but it skips the function when previous job has failed.

`wait()` makes later functions to wait async jobs done from this function. `must()` is similar, but it makes later functions to be skipped when this job has failed.

Alternatively, you can write the equivalant code like below:

```js
import { exec, defer, wait } from 'causation';

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

await exec()
	.and(() => console.log('first'))
	.and(async () => {
		console.log('second started');
		await sleep(500);
		console.log('\nsecond done');
	})
	.and(() => console.log('third'))
	.defer(() => console.log('deferred forth'))
	.and(() => console.log('fifth'))
	.wait(async () => {
		console.log('sixth started');
		await sleep(1000);
		console.log('\nsixth done');
	})
	.and(() => console.log('seventh'))
	.defer();
```

Enqueue task functions with `.and()` method. You can use `.defer()`, `.wait()`, `.chain()`, and `.must()` as a method like as corresponding utility functions.

When you want to await those tasks, you can use `.defer()` or `.chain()` whose argument is empty. `.defer()` ignores errors from failed jobs but `.chain()` throws an error when some jobs has failed. Either method waits until every job has settled.

## License

MIT
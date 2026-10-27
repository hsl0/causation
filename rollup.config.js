import { defineConfig } from 'rollup';

import terser from '@rollup/plugin-terser';
import sourcemaps from 'rollup-plugin-sourcemaps2';

export default defineConfig({
	plugins: [
		sourcemaps()
	],
	input: './dist/main.js',
	output: [
		{
			file: 'dist/main.min.js',
			compact: true,
			sourcemap: true,
			plugins: [
				terser()
			]
		}
	]
});
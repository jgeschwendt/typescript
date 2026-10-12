import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { host } from './host.mjs';
import './typescript6.mjs';

const require = createRequire(import.meta.url);

/** resolved, never loaded: the plugin's index throws at load on ESLint 10 */
const index = import.meta.resolve('eslint-plugin-import');
const names = [
  'no-deprecated',
  'no-extraneous-dependencies',
  'no-import-module-exports',
  'no-internal-modules',
  'no-relative-packages',
  'no-restricted-paths',
  'no-unresolved',
  'no-useless-path-segments',
  'order',
];

/** absolute: once _resolveFilename is patched, bun's createRequire resolves bare names from cwd */
const parserPath = fileURLToPath(import.meta.resolve('@typescript-eslint/parser'));

export default host(
  {
    rules: Object.fromEntries(
      names.map((name) => [name, require(fileURLToPath(new URL(`rules/${name}.js`, index)))]),
    ),
  },
  'import-js',
  (context) => ({
    languageOptions: {
      ...context.languageOptions,
      get parser() {
        return require(parserPath);
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  }),
);

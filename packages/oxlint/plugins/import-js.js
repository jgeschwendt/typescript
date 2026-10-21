import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { host } from './host.js';
import './typescript6.js';

const require = createRequire(import.meta.url);

/** resolved, never loaded: the plugin's index throws at load on ESLint 10 */
const rules = new URL('rules/', import.meta.resolve('eslint-plugin-import'));

/** absolute: once _resolveFilename is patched, bun's createRequire resolves bare names from cwd */
const parserPath = fileURLToPath(import.meta.resolve('@typescript-eslint/parser'));

export default host(
  {
    rules: Object.fromEntries(
      readdirSync(rules).map((file) => [
        file.replace(/\.js$/u, ''),
        require(fileURLToPath(new URL(file, rules))),
      ]),
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

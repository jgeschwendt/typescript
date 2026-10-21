import { host } from './host.js';
import './typescript6.js';

const { createRequire } = process.getBuiltinModule('node:module');
const { fileURLToPath } = process.getBuiltinModule('node:url');

const require = createRequire(import.meta.url);

// dynamic: a static import evaluates the plugin's CommonJS before ./typescript6.js patches the resolver on bun
const { default: plugin } = await import('eslint-plugin-import');

/** absolute: once _resolveFilename is patched, bun's createRequire resolves bare names from cwd */
const parserPath = fileURLToPath(import.meta.resolve('@typescript-eslint/parser'));

export default host(plugin, 'import-js', (context) => ({
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
}));

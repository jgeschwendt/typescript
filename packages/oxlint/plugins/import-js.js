import plugin from 'eslint-plugin-import';
import { host } from './host.js';
import './typescript6.js';

const { createRequire } = process.getBuiltinModule('node:module');
const { fileURLToPath } = process.getBuiltinModule('node:url');

const require = createRequire(import.meta.url);

/** absolute: once _resolveFilename is patched, bun's createRequire resolves bare names from cwd */
const parserPath = fileURLToPath(import.meta.resolve('@typescript-eslint/parser'));

export default host(plugin, 'import-js', (context) => ({
  languageOptions: {
    ...context.languageOptions,
    get parser() {
      return require(parserPath);
    },
  },
}));

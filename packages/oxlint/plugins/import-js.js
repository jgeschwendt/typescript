import plugin from 'eslint-plugin-import';
import { host } from './host.js';
import './typescript6.js';

const { createRequire } = process.getBuiltinModule('node:module');

const require = createRequire(import.meta.url);

export default host(plugin, 'import-js', (context) => ({
  languageOptions: {
    ...context.languageOptions,
    get parser() {
      return require('@typescript-eslint/parser');
    },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
}));

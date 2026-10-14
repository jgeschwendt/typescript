import { defineConfig } from './index.js';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  overrides: [
    // rules are grouped by plugin, each group sorted
    {
      files: ['./index.js'],
      rules: { 'sort-keys': ['error', 'asc', { allowLineSeparatedGroups: true }] },
    },
    {
      files: ['plugins/*.mjs'],
      rules: {
        // eslint-module-utils ignores `exports` maps, the only way these two resolve
        'import-js/no-unresolved': [
          'error',
          { ignore: ['^@typescript-eslint/eslint-plugin$', '^eslint/use-at-your-own-risk$'] },
        ],
        // jsPlugins load a plugin module's default export
        'import/no-default-export': 'off',
        // imported for its resolve-hook side effect
        'import/no-unassigned-import': ['error', { allow: ['**/typescript6.mjs'] }],
      },
    },
    {
      files: ['plugins/host.mjs'],
      // `jsdoc` is ESLint's getJSDocComment verbatim, kept diffable; its contract returns null
      rules: { 'max-statements': 'off', 'unicorn/no-null': 'off' },
    },
    {
      files: ['plugins/typescript6.mjs'],
      // Node's CommonJS resolver hook, the only one Bun routes through
      rules: { 'no-underscore-dangle': ['error', { allow: ['_resolveFilename'] }] },
    },
    {
      files: ['__tests__/*.js'],
      rules: {
        // bun:test is a runtime builtin; the other two resolve only through `exports` maps
        'import-js/no-unresolved': [
          'error',
          {
            ignore: [
              '^@typescript-eslint/eslint-plugin$',
              '^bun:',
              '^eslint/use-at-your-own-risk$',
            ],
          },
        ],
        // a describe callback holds one statement per test it declares
        'max-statements': 'off',
      },
    },
  ],
  // everything here runs inside oxlint's Node/Bun process
  rules: { 'import/no-nodejs-modules': 'off' },
  // no React here: any semver silences eslint-plugin-react's missing-version warning
  settings: { react: { version: '19.2.0' } },
});

import { defineConfig } from './index.js';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  overrides: [
    {
      files: ['plugins/*.js'],
      rules: {
        // jsPlugins load a plugin module's default export
        'import/no-default-export': 'off',
        // imported for its resolve-hook side effect
        'import/no-unassigned-import': ['error', { allow: ['**/typescript6.js'] }],
        // eslint-module-utils ignores `exports` maps, the only way these two resolve
        'import-js/no-unresolved': [
          'error',
          { ignore: ['^@typescript-eslint/eslint-plugin$', '^eslint/use-at-your-own-risk$'] },
        ],
        'unicorn-js/no-top-level-side-effects': 'off',
      },
    },
    {
      files: ['plugins/host.js'],
      // `jsdoc` is ESLint's getJSDocComment, kept diffable; its contract returns null;
      // consumers load this on Node 22, which ESLint and unicorn admit, with no Error.isError (verified 2026-10-20 · 22.23.3 probe)
      rules: {
        'max-statements': 'off',
        'unicorn/no-null': 'off',
        'unicorn-js/prefer-error-is-error': 'off',
      },
    },
    {
      files: ['plugins/typescript6.js'],
      // Node's CommonJS resolver hook, the only one Bun routes through, called with Module as `this`
      rules: {
        'no-underscore-dangle': ['error', { allow: ['_resolveFilename'] }],
        'unicorn-js/no-this-outside-of-class': 'off',
      },
    },
    {
      files: ['index.js'],
      // defineConfig records into enabled.js's set what the hosts list to oxlint
      rules: { 'import-js/no-internal-modules': ['error', { allow: ['**/plugins/enabled.js'] }] },
    },
    {
      files: ['__tests__/{_helpers,define-config.test}.js'],
      // the two files that import the module under test, ../index.js
      rules: { 'import/no-relative-parent-imports': 'off' },
    },
    {
      files: ['__tests__/*.js'],
      // string arrays: the default code-unit order is the snapshot's order
      rules: { 'unicorn-js/require-array-sort-compare': 'off' },
    },
  ],
  rules: {
    // house comment style (jgeschwendt/claude rules/comments.md): one-line docblocks
    'unicorn-js/single-line-block-comment-style': ['error', 'single-line'],
  },
});

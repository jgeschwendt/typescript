import { defineConfig } from './index.js';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  overrides: [
    // rules are grouped by plugin, each group sorted
    {
      files: ['index.js'],
      rules: { 'sort-keys': ['error', 'asc', { allowLineSeparatedGroups: true }] },
    },
    {
      files: ['plugins/*.js'],
      rules: {
        // eslint-module-utils ignores `exports` maps, the only way these two resolve
        'import-js/no-unresolved': [
          'error',
          { ignore: ['^@typescript-eslint/eslint-plugin$', '^eslint/use-at-your-own-risk$'] },
        ],
        // jsPlugins load a plugin module's default export
        'import/no-default-export': 'off',
        // eslint-plugin-import loads per rule by path: its index needs ESLint 9 internals
        'import/no-dynamic-require': 'off',
        // imported for its resolve-hook side effect
        'import/no-unassigned-import': ['error', { allow: ['**/typescript6.js'] }],
        'unicorn-js/no-top-level-side-effects': 'off',
      },
    },
    {
      files: ['plugins/host.js'],
      // `jsdoc` is ESLint's getJSDocComment, kept diffable; its contract returns null;
      // consumers load this on Node 22, which ESLint and unicorn admit, with no Error.isError (verified 2026-10-20 · 22.23.3 probe)
      rules: {
        'max-statements': 'off',
        'unicorn-js/prefer-error-is-error': 'off',
        'unicorn/no-null': 'off',
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
    // everything here runs inside oxlint's Node/Bun process, no bundler: chunk names mean nothing
    'import-js/dynamic-import-chunkname': 'off',
    'import/no-nodejs-modules': 'off',
    // house comment style (jgeschwendt/claude rules/comments.md): one-line docblocks
    'unicorn-js/single-line-block-comment-style': ['error', 'single-line'],
  },
});

import { defineConfig } from './index.js';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  overrides: [
    // rules are grouped by plugin, each group sorted
    {
      files: ['./index.js'],
      rules: { 'sort-keys': ['error', 'asc', { allowLineSeparatedGroups: true }] },
    },
    // Node 24.21, which consumers load these on, has no Iterator.concat (verified 2026-10-14 · probe); TypeScript 5's lib declares none
    {
      files: ['./index.js', '__tests__/*.js', 'plugins/*.mjs'],
      rules: { 'unicorn-js/prefer-iterator-concat': 'off' },
    },
    {
      files: ['plugins/*.mjs'],
      rules: {
        // eslint-module-utils ignores `exports` maps, the only way these two resolve
        'import-js/no-unresolved': [
          'error',
          { ignore: ['^@typescript-eslint/eslint-plugin$', '^eslint/use-at-your-own-risk$'] },
        ],
        // jsPlugins load a plugin module's default export, here a host(…) call
        'import/no-default-export': 'off',
        // eslint-plugin-import loads per rule by path: its index needs ESLint 9 internals
        'import/no-dynamic-require': 'off',
        // imported for its resolve-hook side effect
        'import/no-unassigned-import': ['error', { allow: ['**/typescript6.mjs'] }],
        'unicorn-js/no-top-level-side-effects': 'off',
      },
    },
    {
      files: ['plugins/host.mjs'],
      // `jsdoc` is ESLint's getJSDocComment verbatim, kept diffable; its contract returns null;
      // Node 22, inside the runtime floor, has no Error.isError (verified 2026-10-14 · probe)
      rules: {
        'max-statements': 'off',
        'unicorn-js/prefer-error-is-error': 'off',
        'unicorn/no-null': 'off',
      },
    },
    {
      files: ['plugins/typescript6.mjs'],
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
        // string arrays: the default code-unit order is the snapshot's order
        'unicorn-js/require-array-sort-compare': 'off',
      },
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

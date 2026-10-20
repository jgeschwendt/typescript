import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  overrides: [
    {
      files: ['__tests__/*.js'],
      rules: {
        // bun:test is a runtime builtin eslint-module-utils cannot resolve
        'import-js/no-unresolved': ['error', { ignore: ['^bun:'] }],
        // the tests import the package root, ../index.js
        'import/no-relative-parent-imports': 'off',
      },
    },
  ],
  rules: {
    // house code golf: an expression body over a return statement, however oxfmt wraps it
    'unicorn-js/consistent-arrow-return-style': 'off',
    // house comment style (jgeschwendt/claude rules/comments.md): one-line docblocks
    'unicorn-js/single-line-block-comment-style': ['error', 'single-line'],
  },
});

import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  // bun:test is a runtime builtin eslint-module-utils cannot resolve
  overrides: [
    {
      files: ['__tests__/*.js'],
      rules: { 'import-js/no-unresolved': ['error', { ignore: ['^bun:'] }] },
    },
  ],
  rules: {
    // house code golf: an expression body over a return statement, however oxfmt wraps it
    'unicorn-js/consistent-arrow-return-style': 'off',
    // house comment style (jgeschwendt/claude rules/comments.md): one-line docblocks
    'unicorn-js/single-line-block-comment-style': ['error', 'single-line'],
  },
  // eslint-plugin-react warns on runs without a react version
  settings: { react: { version: '19' } },
});

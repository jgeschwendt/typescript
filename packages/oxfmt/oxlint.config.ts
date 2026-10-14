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
  // eslint-plugin-react warns on runs without a react version
  settings: { react: { version: '19' } },
});

import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  overrides: [
    {
      files: ['__tests__/define-config.test.js'],
      rules: { 'import/no-relative-parent-imports': 'off' },
    },
  ],
});

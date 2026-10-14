import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  options: { reportUnusedDisableDirectives: 'error', typeAware: true },
});

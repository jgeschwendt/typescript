import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  // root-only: a nested config naming options fails the run
  options: { reportUnusedDisableDirectives: 'error', typeAware: true },
});

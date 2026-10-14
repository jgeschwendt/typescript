import { defineConfig } from '@jlg/lint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  options: { reportUnusedDisableDirectives: 'error', typeAware: true },
  // no React here: any semver silences eslint-plugin-react's missing-version warning
  settings: { react: { version: '19.2.0' } },
});

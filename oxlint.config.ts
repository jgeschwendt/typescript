import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  options: { reportUnusedDisableDirectives: 'error', typeAware: true },
  // no react here: any semver silences eslint-plugin-react's missing-version warning
  settings: { react: { version: '19' } },
});

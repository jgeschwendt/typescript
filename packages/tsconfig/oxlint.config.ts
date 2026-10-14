import { defineConfig } from '@jlg/lint';

export default defineConfig({
  // eslint-plugin-react warns on runs without a react version
  settings: { react: { version: '19' } },
});

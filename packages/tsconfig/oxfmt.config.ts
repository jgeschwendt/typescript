import { defineConfig } from '@jlg/oxfmt';

export default defineConfig({
  // keys layer over the base; oxfmt has no `extends`—this is a merge
  ignorePatterns: ['dist/**'],
  sortTailwindcss: true,
});

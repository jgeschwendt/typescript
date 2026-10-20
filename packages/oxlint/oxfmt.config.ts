import { defineConfig } from '@jlg/oxfmt';

export default defineConfig({
  // ui.css is vendored verbatim from jgeschwendt/ui
  ignorePatterns: ['__tests__/ui.css'],
});

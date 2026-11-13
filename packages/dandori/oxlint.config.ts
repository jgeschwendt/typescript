import { defineConfig } from '@jlg/oxlint';

// tsrs is the compiler here, so the base finds no TypeScript dependency to detect
export default defineConfig({ env: { typescript: true } });

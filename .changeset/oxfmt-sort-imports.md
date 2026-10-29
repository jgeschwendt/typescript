---
'@jlg/oxfmt': patch
---

The base now sorts imports (`sortImports`: builtin and external together, then internal, index, sibling, parent; case-sensitive; no blank lines between groups) and `package.json` (`sortPackageJson` with `sortScripts`), so `import/order` is formatting oxfmt owns and `@jlg/oxlint` 0.1.5 turns the lint rule off with that reason. The entry is `index.js` (was `index.mjs`) and exports `defineConfig` only; the `base` export is gone, as a no-argument `defineConfig()` returns the same fresh copy. The entry reads the JSON through `process.getBuiltinModule`, so Node 22.3 or Bun is the floor.

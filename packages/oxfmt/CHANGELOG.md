# @jlg/oxfmt

## 0.1.2

### Patch Changes

- [#98](https://github.com/jgeschwendt/typescript/pull/98) [`0bb0bf3`](https://github.com/jgeschwendt/typescript/commit/0bb0bf338114754c39dc11b25375713075c7919b) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - The base now sorts imports (`sortImports`: builtin and external together, then internal, index, sibling, parent; case-sensitive; no blank lines between groups) and `package.json` (`sortPackageJson` with `sortScripts`), so `import/order` is formatting oxfmt owns and `@jlg/oxlint` 0.1.5 turns the lint rule off with that reason. The entry is `index.js` (was `index.mjs`) and exports `defineConfig` only; the `base` export is gone, as a no-argument `defineConfig()` returns the same fresh copy. The entry reads the JSON through `process.getBuiltinModule`, so Node 22.3 or Bun is the floor.

## 0.1.1

### Patch Changes

- [#16](https://github.com/jgeschwendt/typescript/pull/16) [`67584ce`](https://github.com/jgeschwendt/typescript/commit/67584cefb29bdf5d8bef27ced66605d4f17335b4) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Docs: oxfmt 0.72 auto-discovers only `oxfmt.config.ts`/`.mts` (other extensions load with `-c`), and the base's single-quote style is recorded as the stack decision.

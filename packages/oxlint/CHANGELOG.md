# @jlg/oxlint

## 0.2.0

### Minor Changes

- [#16](https://github.com/jgeschwendt/typescript/pull/16) [`67584ce`](https://github.com/jgeschwendt/typescript/commit/67584cefb29bdf5d8bef27ced66605d4f17335b4) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Restore 36 rules the eslint→oxlint migration dropped, as the original ESLint rule code through oxlint's `jsPlugins`: `import-js/*` (incl. `order`), `react-js/*`, `unicorn-js/*`, `eslint-js/*` (core rules) and `typescript-js/{member-ordering,naming-convention}`. New lint errors for consumers; `oxlint` is now pinned exactly (1.87.0) because JS plugins are outside its semver. See README "Restored through JS plugins" and GAPS.md.

### Patch Changes

- [#16](https://github.com/jgeschwendt/typescript/pull/16) [`67584ce`](https://github.com/jgeschwendt/typescript/commit/67584cefb29bdf5d8bef27ced66605d4f17335b4) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Publish `GAPS.md`: every rule `@jlg/eslint` enforced that this base does not enforce the same way, resolved per file type against oxlint 1.87 — including `import/order`, which the migration dropped unrecorded.

# @jlg/oxlint

## 0.1.2

### Patch Changes

- [#28](https://github.com/jgeschwendt/typescript/pull/28) [`f6bc9f6`](https://github.com/jgeschwendt/typescript/commit/f6bc9f65c8382613a57d5250f10743820bfd5f15) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - The base is now `index.js`: `defineConfig()` builds it in JavaScript and returns one flat config, with no `extends`. Breaking: the published `oxlintrc.jsonc` (the JSON `extends` path) and the `base` export are gone — consume it from an `oxlint.config.ts`. The TypeScript, React (`**/*.tsx`) and Next overrides now apply only when `typescript`, `react` or `next` is in the nearest `package.json`'s dependencies or devDependencies (all three when no `package.json` is found); force them with `defineConfig({ env: { next: true } })`. Consumer overrides now come after every base override, so a consumer `**/*.tsx` override beats the Next segment-file exemptions — the reverse of before. A nested config (`.oxlintrc.json` or `oxlint.config.ts`) replaces the root for its subtree rather than merging, so a nested `oxlint.config.ts` must call `defineConfig` itself and carry everything it needs (`options` stay root-only).

  GAPS.md no longer ships in the package: the `__tests__/eslint-parity.test.js` snapshot replaces it and COMPARISON.md.

- [#28](https://github.com/jgeschwendt/typescript/pull/28) [`f6bc9f6`](https://github.com/jgeschwendt/typescript/commit/f6bc9f65c8382613a57d5250f10743820bfd5f15) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - JS plugins move to ESLint 10 and eslint-plugin-unicorn ^77 (was pinned 60.0.0). Breaking for configs naming the old rules: `unicorn-js/prevent-abbreviations` is now `unicorn-js/name-replacements`, `unicorn-js/prefer-json-parse-buffer` is now `unicorn-js/consistent-json-file-read` (set to `"buffer"`, which now also flags a bare `readFileSync`), and `unicorn-js/better-regex` (removed upstream) and `import-js/no-unused-modules` (needs ESLint 9 internals) are gone. `unicorn-js/expiring-todo-comments` keeps date checks on; `unicorn-js/consistent-destructuring` now reports only members already destructured.

## 0.1.1

### Patch Changes

- [#16](https://github.com/jgeschwendt/typescript/pull/16) [`67584ce`](https://github.com/jgeschwendt/typescript/commit/67584cefb29bdf5d8bef27ced66605d4f17335b4) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Restore 36 rules the eslint→oxlint migration dropped, as the original ESLint rule code through oxlint's `jsPlugins`: `import-js/*` (incl. `order`), `react-js/*`, `unicorn-js/*`, `eslint-js/*` (core rules) and `typescript-js/{member-ordering,naming-convention}`. New lint errors for consumers; `oxlint` is now pinned exactly (1.87.0) because JS plugins are outside its semver. See README "Restored through JS plugins" and GAPS.md.

- [#16](https://github.com/jgeschwendt/typescript/pull/16) [`67584ce`](https://github.com/jgeschwendt/typescript/commit/67584cefb29bdf5d8bef27ced66605d4f17335b4) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Publish `GAPS.md`: every rule `@jlg/eslint` enforced that this base does not enforce the same way, resolved per file type against oxlint 1.87 — including `import/order`, which the migration dropped unrecorded.

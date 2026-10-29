# @jlg/oxlint

## 0.1.5

### Patch Changes

- [#96](https://github.com/jgeschwendt/typescript/pull/96) [`ccf323a`](https://github.com/jgeschwendt/typescript/commit/ccf323a8410e511d713928e52fe70a6ba36cdefa) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Peer `oxlint` is `^1.89.0` (was pinned exactly); rule and plugin names are checked against the installed oxlint, so a name only a newer oxlint knows is emitted only where it exists. Node floors are 22 and 24. `oxlint-tsgolint` is now a dependency: with TypeScript detected, type-aware linting turns on without a consumer-side install, and the config at the lint root sets `reportUnusedDisableDirectives` and `typeAware` itself. Environment detection (TypeScript, React, Next, oxfmt `printWidth` for the comment rules) starts from the config file's directory, so a monorepo package lints against its own manifest; a shared config wrapping `defineConfig` keeps the root options. The plugin hosts register only the rules a config names (lint time down about a sixth).

  Rules: new `types/prefer-readonly-generic` (`Readonly<{…}>` over per-member `readonly`) and `consistent-type-definitions: type` beside it; one import statement per module (`import { type T, x }`); `sort-keys` natural with blank-line groups; `func-style` is expression by default, declaration in `.jsx`/`.tsx` and in Next's `route`, `instrumentation`, `middleware`, `proxy` and metadata files, with Next segment files keeping named exports as expressions; `max-statements` ignores a lone top-level function; `react/jsx-max-depth` 7; `react-perf/*` and `react-js/jsx-no-bind` spare host elements; `eslint-js/consistent-return` is on again for JS (the native rule covers TS); `react/function-component-definition` is on for `.jsx`/`.tsx`; Next's default-export and multi-export file conventions are exempt from `no-default-export` and `group-exports` by name, and the route override covers `route.{js,ts}`; `name-replacements` keeps React's `props`/`ref`/`refs` and Next's `params`; quoted type properties are exempt from `naming-convention`, whose lists are exported as `namingConvention`; tooling configs may import node builtins; `dynamic-import-chunkname` is off; the React preset no longer sets `env.browser`. Every opt-out lives in one `off` map with its reason, and the rules page gains a type-aware column and a docs link per rule.

## 0.1.4

### Patch Changes

- [#43](https://github.com/jgeschwendt/typescript/pull/43) [`3e303ea`](https://github.com/jgeschwendt/typescript/commit/3e303eab55005dff93f6db2d1765562ddb72db5b) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - unicorn/consistent-json-file-read runs at its default (`string`): `JSON.parse(Buffer)` fails tsc

## 0.1.3

### Patch Changes

- [#37](https://github.com/jgeschwendt/typescript/pull/37) [`d3f4155`](https://github.com/jgeschwendt/typescript/commit/d3f4155c939c01ab5bbdf86ee4636a69b6ff93d6) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Every non-deprecated rule of the wrapped plugins that oxlint lacks now runs through the JS plugins unless opted out: `index.js` derives the set at import from the installed oxlint's `configuration_schema.json`, skips type-checked rules (`naming-convention` still runs untyped) and the reasoned `disabled` map (41 entries: crashes, duplicates of native rules, formatting oxfmt owns, non-JS languages, no-ops). 285 rules now run, up from 40: 12 `eslint-js`, 10 `import-js`, 27 `react-js`, 3 `typescript-js` (TS files only, where `eslint-js/consistent-return`, `dot-notation` and `no-invalid-this` give way to typescript-eslint's extensions) and 233 `unicorn-js`, plus `inline-config`. Root tooling configs may default-export their `defineConfig(…)` call (`unicorn-js/no-top-level-side-effects` off there). Each plugin wrapper now registers its whole catalog, so any opted-out rule can be turned on by name.

## 0.1.2

### Patch Changes

- [#28](https://github.com/jgeschwendt/typescript/pull/28) [`f6bc9f6`](https://github.com/jgeschwendt/typescript/commit/f6bc9f65c8382613a57d5250f10743820bfd5f15) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - The base is now `index.js`: `defineConfig()` builds it in JavaScript and returns one flat config, with no `extends`. Breaking: the published `oxlintrc.jsonc` (the JSON `extends` path) and the `base` export are gone — consume it from an `oxlint.config.ts`. The TypeScript, React (`**/*.tsx`) and Next overrides now apply only when `typescript`, `react` or `next` is in the nearest `package.json`'s dependencies or devDependencies (all three when no `package.json` is found); force them with `defineConfig({ env: { next: true } })`. Consumer overrides now come after every base override, so a consumer `**/*.tsx` override beats the Next segment-file exemptions — the reverse of before. A nested config (`.oxlintrc.json` or `oxlint.config.ts`) replaces the root for its subtree rather than merging, so a nested `oxlint.config.ts` must call `defineConfig` itself and carry everything it needs (`options` stay root-only).

  GAPS.md no longer ships in the package: the `__tests__/eslint-parity.test.js` snapshot replaces it and COMPARISON.md.

- [#28](https://github.com/jgeschwendt/typescript/pull/28) [`f6bc9f6`](https://github.com/jgeschwendt/typescript/commit/f6bc9f65c8382613a57d5250f10743820bfd5f15) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - JS plugins move to ESLint 10 and eslint-plugin-unicorn ^77 (was pinned 60.0.0). Breaking for configs naming the old rules: `unicorn-js/prevent-abbreviations` is now `unicorn-js/name-replacements`, `unicorn-js/prefer-json-parse-buffer` is now `unicorn-js/consistent-json-file-read` (set to `"buffer"`, which now also flags a bare `readFileSync`), and `unicorn-js/better-regex` (removed upstream) and `import-js/no-unused-modules` (needs ESLint 9 internals) are gone. `unicorn-js/expiring-todo-comments` keeps date checks on; `unicorn-js/consistent-destructuring` now reports only members already destructured.

## 0.1.1

### Patch Changes

- [#16](https://github.com/jgeschwendt/typescript/pull/16) [`67584ce`](https://github.com/jgeschwendt/typescript/commit/67584cefb29bdf5d8bef27ced66605d4f17335b4) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Restore 36 rules the eslint→oxlint migration dropped, as the original ESLint rule code through oxlint's `jsPlugins`: `import-js/*` (incl. `order`), `react-js/*`, `unicorn-js/*`, `eslint-js/*` (core rules) and `typescript-js/{member-ordering,naming-convention}`. New lint errors for consumers; `oxlint` is now pinned exactly (1.87.0) because JS plugins are outside its semver. See README "Restored through JS plugins" and GAPS.md.

- [#16](https://github.com/jgeschwendt/typescript/pull/16) [`67584ce`](https://github.com/jgeschwendt/typescript/commit/67584cefb29bdf5d8bef27ced66605d4f17335b4) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Publish `GAPS.md`: every rule `@jlg/eslint` enforced that this base does not enforce the same way, resolved per file type against oxlint 1.87 — including `import/order`, which the migration dropped unrecorded.

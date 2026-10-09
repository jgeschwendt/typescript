# Gaps from `@jlg/eslint`

Every rule `@jlg/eslint` (`@jgeschwendt/eslint@0.0.0-canary.0`, its last release) enforced that
this base does not enforce the same way, against **oxlint 1.87**. Resolved, not read off the source:
ESLint's `calculateConfigForFile` on a Next + React + TypeScript probe (every conditional block on)
for `a.js`, `a.ts`, `a.tsx` and the Next route files, diffed against this package's `oxlintrc.jsonc`
(categories, rules, overrides) and `oxlint --rules`, matching rules by plugin and name. The resolved
ESLint side is `__tests__/fixtures/eslint-baseline.json`. (measured 2026-10-09 · baseline × `oxlint
--rules --format json` × `oxlintrc.jsonc`)

| bucket                                                     | rules |
| ---------------------------------------------------------- | ----: |
| [No oxlint rule — real gaps](#no-oxlint-rule--real-gaps)   |    42 |
| [No oxlint rule — moot](#no-oxlint-rule--moot)             |    25 |
| [In oxlint, off in this base](#in-oxlint-off-in-this-base) |    11 |
| [Options changed](#options-changed)                        |     4 |
| [error → warn](#error--warn)                               |    73 |

A rule listed without files applies to every probed file; otherwise the files it was on for. "TS
files" is the eight `.ts`/`.tsx` probes (`a.ts`, `a.tsx`, `app/layout.tsx`, `app/page.tsx`,
`app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`).

**Versions.** The baseline resolves eslint 9.38.0, typescript-eslint 8.71.1, eslint-plugin-unicorn
60.0.0, eslint-plugin-react 7.37.5, eslint-plugin-import 2.32.0 and eslint-config-prettier 10.1.8.
jlg.io, the consumer, ran typescript-eslint **8.61.0**: `no-unsafe-enum-assignment` and
`no-generated-empty-object-type` did not exist there, `@typescript-eslint/no-loop-func` did (core
`no-loop-func` covers it), and its `member-ordering` lacks 8.71's earlier-member-reference exemption,
so the restored rule, on 8.71, is slightly more permissive. (verified 2026-10-09 · jlg.io `bun.lock`
before the oxlint adoption)

**The base only.** Consumers layered their own ESLint configs on top, and some behavior lived
there: import sorting was jlg.io's own `.eslintrc` (alphabetized `import/order`, until
2021-12-31), never `@jlg/eslint`, whose `import/order` ran its non-sorting defaults. Before
calling a behavior lost or never-enforced, check the consumer's lint history too.

**Same rule, different engine.** A rule present in both can still decide differently; the
differences found by probe are listed in the README ("Engine differences").

## No oxlint rule — real gaps

Enforced by `@jlg/eslint`, absent from oxlint 1.87 under its own plugin. 37 run again as the
original ESLint rule code through `jsPlugins` (README, "Restored through JS plugins"); 5 are open.

| rule                                                      | was   | status                                                                                                                                              |
| --------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/member-ordering` (TS files)           | error | **restored** as `typescript-js/member-ordering`                                                                                                     |
| `@typescript-eslint/naming-convention` (TS files)         | warn  | **restored** as `typescript-js/naming-convention`, with the `.ts`, `.tsx` and `route.ts` option sets                                                |
| `@typescript-eslint/no-unsafe-enum-assignment` (TS files) | error | **open** — type-aware; oxlint runs type-aware rules in tsgolint, and JS plugins get no types. Not in typescript-eslint 8.61, so jlg.io never ran it |
| `camelcase`                                               | error | **restored** as `eslint-js/camelcase`                                                                                                               |
| `consistent-return` (`a.js`)                              | error | **open** — oxlint has only the type-aware `typescript/consistent-return`, off on JS files here                                                      |
| `consistent-this`                                         | error | **restored** as `eslint-js/consistent-this`                                                                                                         |
| `dot-notation` (`a.js`)                                   | error | **open** — oxlint has only the type-aware `typescript/dot-notation`, off on JS files here                                                           |
| `import/no-deprecated`                                    | error | **restored** as `import-js/no-deprecated`                                                                                                           |
| `import/no-extraneous-dependencies`                       | error | **restored** as `import-js/no-extraneous-dependencies`                                                                                              |
| `import/no-import-module-exports`                         | error | **restored** as `import-js/no-import-module-exports`                                                                                                |
| `import/no-internal-modules`                              | error | **restored** as `import-js/no-internal-modules`                                                                                                     |
| `import/no-relative-packages`                             | error | **restored** as `import-js/no-relative-packages`                                                                                                    |
| `import/no-unresolved` (`a.js`)                           | error | **restored** as `import-js/no-unresolved`, on JS files: TypeScript checks no JS file without `allowJs`/`checkJs`                                    |
| `import/no-useless-path-segments`                         | error | **restored** as `import-js/no-useless-path-segments`                                                                                                |
| `import/order`                                            | error | **restored** as `import-js/order`, with changed options ([below](#options-changed))                                                                 |
| `no-invalid-this` (`a.js`)                                | error | **restored** as `eslint-js/no-invalid-this`, on JS files: `noImplicitThis` covers TypeScript only                                                   |
| `no-octal`                                                | error | **open** for a JS file with no `import`/`export`: oxlint parses it as a script, where `017` is legal. In a module it is a parse error               |
| `no-octal-escape`                                         | error | **open** for a JS file with no `import`/`export`, as `no-octal`                                                                                     |
| `no-undef-init`                                           | error | **restored** as `eslint-js/no-undef-init`                                                                                                           |
| `react/destructuring-assignment`                          | error | **restored** as `react-js/destructuring-assignment`                                                                                                 |
| `react/jsx-no-bind`                                       | error | **restored** as `react-js/jsx-no-bind`                                                                                                              |
| `react/jsx-no-leaked-render`                              | error | **restored** as `react-js/jsx-no-leaked-render`                                                                                                     |
| `react/jsx-sort-props`                                    | error | **restored** as `react-js/jsx-sort-props`                                                                                                           |
| `react/no-adjacent-inline-elements`                       | error | **restored** as `react-js/no-adjacent-inline-elements`                                                                                              |
| `react/no-deprecated`                                     | error | **restored** as `react-js/no-deprecated`                                                                                                            |
| `react/no-invalid-html-attribute`                         | error | **restored** as `react-js/no-invalid-html-attribute`                                                                                                |
| `react/no-typos`                                          | error | **restored** as `react-js/no-typos`                                                                                                                 |
| `react/no-unused-prop-types`                              | error | **restored** as `react-js/no-unused-prop-types`                                                                                                     |
| `react/prefer-read-only-props`                            | error | **restored** as `react-js/prefer-read-only-props`                                                                                                   |
| `react/require-default-props`                             | error | **restored** as `react-js/require-default-props`, with changed options ([below](#options-changed))                                                  |
| `require-atomic-updates`                                  | error | **restored** as `eslint-js/require-atomic-updates`                                                                                                  |
| `unicorn/better-regex`                                    | error | **restored** as `unicorn-js/better-regex`                                                                                                           |
| `unicorn/consistent-destructuring`                        | error | **restored** as `unicorn-js/consistent-destructuring`                                                                                               |
| `unicorn/expiring-todo-comments`                          | error | **restored** as `unicorn-js/expiring-todo-comments`                                                                                                 |
| `unicorn/no-for-loop`                                     | error | **restored** as `unicorn-js/no-for-loop`                                                                                                            |
| `unicorn/no-keyword-prefix`                               | error | **restored** as `unicorn-js/no-keyword-prefix`                                                                                                      |
| `unicorn/no-named-default`                                | error | **restored** as `unicorn-js/no-named-default`; native `import/no-named-default` misses the `export { x as default }` side                           |
| `unicorn/no-unnecessary-polyfills`                        | error | **restored** as `unicorn-js/no-unnecessary-polyfills`                                                                                               |
| `unicorn/no-unused-properties`                            | error | **restored** as `unicorn-js/no-unused-properties`                                                                                                   |
| `unicorn/prefer-json-parse-buffer`                        | error | **restored** as `unicorn-js/prefer-json-parse-buffer`                                                                                               |
| `unicorn/prefer-switch`                                   | error | **restored** as `unicorn-js/prefer-switch`                                                                                                          |
| `unicorn/prevent-abbreviations`                           | error | **restored** as `unicorn-js/prevent-abbreviations`                                                                                                  |

`consistent-return`, `dot-notation`, `no-octal` and `no-octal-escape` would come back the same way,
as `eslint-js/*` rules (the first two in the JS-files override).

## No oxlint rule — moot

Absent from oxlint, but nothing is lost on this stack. The first five run through `jsPlugins` all
the same, as hooks a consumer can give options to: without options they check nothing, under
`@jlg/eslint` as here.

| rule                                            | why                                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import/no-restricted-paths`                    | no-op without `zones`; loaded as `import-js/no-restricted-paths`                                                                                                 |
| `import/no-unused-modules`                      | no-op without `unusedExports`/`missingExports`; loaded as `import-js/no-unused-modules`. With them it also needs an `.eslintrc` stub (eslint-plugin-import#3079) |
| `no-restricted-syntax`                          | no-op without selectors; loaded as `eslint-js/no-restricted-syntax`                                                                                              |
| `react/boolean-prop-naming`                     | no-op without `rule` (its pattern is `null`); loaded as `react-js/boolean-prop-naming`                                                                           |
| `unicorn/string-content`                        | no-op without `patterns`; loaded as `unicorn-js/string-content`                                                                                                  |
| `@typescript-eslint/no-invalid-this` (TS files) | TS `noImplicitThis` (on under `strict`) covers it                                                                                                                |
| `no-dupe-args` (`a.js`)                         | a parse error in a module; in a script, `no-redeclare` reports the duplicate                                                                                     |
| `react/default-props-match-prop-types`          | propTypes era; TypeScript props replace it                                                                                                                       |
| `react/forbid-foreign-prop-types`               | propTypes era; TypeScript props replace it                                                                                                                       |
| `react/forbid-prop-types`                       | propTypes era; TypeScript props replace it                                                                                                                       |
| `react/jsx-uses-react`                          | oxlint `no-unused-vars` understands JSX natively                                                                                                                 |
| `react/jsx-uses-vars`                           | oxlint `no-unused-vars` understands JSX natively                                                                                                                 |
| `react/no-access-state-in-setstate`             | class components only                                                                                                                                            |
| `react/no-arrow-function-lifecycle`             | class components only                                                                                                                                            |
| `react/no-unused-class-component-methods`       | class components only                                                                                                                                            |
| `react/no-unused-state`                         | class components only                                                                                                                                            |
| `react/prefer-exact-props`                      | propTypes era; TypeScript props replace it                                                                                                                       |
| `react/prefer-stateless-function`               | class components only                                                                                                                                            |
| `react/prop-types`                              | propTypes era; TypeScript props replace it                                                                                                                       |
| `react/require-optimization`                    | class components only                                                                                                                                            |
| `react/sort-comp`                               | class components only                                                                                                                                            |
| `react/sort-default-props`                      | propTypes era; TypeScript props replace it                                                                                                                       |
| `react/sort-prop-types`                         | propTypes era; TypeScript props replace it                                                                                                                       |
| `react/static-property-placement`               | class components only                                                                                                                                            |
| `strict`                                        | `@jlg/eslint` parsed every file as a module, so it only flagged `'use strict'`; `unicorn/prefer-module` (warn) flags that                                        |

## In oxlint, off in this base

`nursery` is off by policy (unstable rules); the rest are explicit offs in `oxlintrc.jsonc`.

| rule                                                              | why off                                                                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-unnecessary-condition` (TS files)          | `nursery` category                                                                                                                                                            |
| `@typescript-eslint/prefer-optional-chain` (TS files)             | `nursery` category                                                                                                                                                            |
| `import/export`                                                   | `nursery` category                                                                                                                                                            |
| `import/named` (`a.js`)                                           | `nursery` category                                                                                                                                                            |
| `import/no-default-export` (`app/route.ts`, `instrumentation.ts`) | set `off` here, a wider exemption than `@jlg/eslint`'s (layout, page, middleware, robots); neither file convention default-exports. Kept wider by owner decision (2026-10-09) |
| `no-restricted-exports`                                           | `nursery` category                                                                                                                                                            |
| `no-undef` (`a.js`)                                               | `nursery` category                                                                                                                                                            |
| `no-unreachable-loop`                                             | `nursery` category                                                                                                                                                            |
| `no-useless-assignment`                                           | `nursery` category                                                                                                                                                            |
| `react/function-component-definition`                             | set `off` here: one blanket component style, where this stack's policy is per-file `func-style`                                                                               |
| `react/require-render-return`                                     | `nursery` category                                                                                                                                                            |

## Options changed

| rule                                                                                           | `@jlg/eslint`                                                                                  | here                                                                                                                                  |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `func-style` (`a.tsx`, `app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`) | `"declaration", {"allowArrowFunctions": false, "allowTypeAnnotation": false, "overrides": {}}` | oxlint defaults (`"expression"`); not carried over                                                                                    |
| `func-style` (`app/layout.tsx`, `app/page.tsx`)                                                | as above, with `"overrides": {"namedExports": "expression"}`                                   | oxlint defaults; not carried over                                                                                                     |
| `import/order`                                                                                 | defaults, which never alphabetize                                                              | jlg.io's pre-2022 alphabetized groups, plus an `internal` path group for `@/`                                                         |
| `react/jsx-filename-extension`                                                                 | `{"extensions": [".jsx", ".tsx"]}`                                                             | oxlint defaults; not carried over                                                                                                     |
| `react/require-default-props`                                                                  | default `{"functions": "defaultProps"}`                                                        | `{"functions": "defaultArguments"}`: React 19 ignores `defaultProps` on function components, so the default goes in the destructuring |

`sort-imports` matches in effect: `@jlg/eslint` spelled out the defaults, this base sets only
`ignoreDeclarationSort`. Where oxlint's own defaults differ from ESLint's, this base spells out
ESLint's: `id-length` (plus the oxlint-only `checkGeneric: false`), `no-inner-declarations`,
`no-irregular-whitespace`, `no-shadow-restricted-names` and `no-unused-vars` (plus
`reportVarsOnlyUsedAsTypes`, typescript-eslint's "only used as a type" report).

## error → warn

All but one come from one decision: the `restriction` category runs at `warn` (see `oxlintrc.jsonc`). The exception, `@typescript-eslint/prefer-readonly-parameter-types`, is set to `warn` there by name.

Scope, per the baseline: the `@typescript-eslint/*` entries applied to TypeScript files only, and `class-methods-use-this`, `import/extensions`, `no-empty-function` and `no-use-before-define` to `.js` only (their TypeScript twins replaced them); every other entry applied to all files.

`@typescript-eslint/class-methods-use-this`, `@typescript-eslint/explicit-function-return-type`, `@typescript-eslint/explicit-member-accessibility`, `@typescript-eslint/explicit-module-boundary-types`, `@typescript-eslint/no-dynamic-delete`, `@typescript-eslint/no-empty-function`, `@typescript-eslint/no-empty-object-type`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-import-type-side-effects`, `@typescript-eslint/no-invalid-void-type`, `@typescript-eslint/no-namespace`, `@typescript-eslint/no-non-null-asserted-nullish-coalescing`, `@typescript-eslint/no-non-null-assertion`, `@typescript-eslint/no-require-imports`, `@typescript-eslint/no-restricted-types`, `@typescript-eslint/no-use-before-define`, `@typescript-eslint/non-nullable-type-assertion-style`, `@typescript-eslint/prefer-literal-enum-member`, `@typescript-eslint/prefer-readonly-parameter-types`, `@typescript-eslint/promise-function-async`, `@typescript-eslint/use-unknown-in-catch-callback-variable`, `class-methods-use-this`, `complexity`, `default-case`, `import/extensions`, `import/no-amd`, `import/no-commonjs`, `import/no-cycle`, `import/no-dynamic-require`, `import/no-relative-parent-imports`, `import/no-webpack-loader-syntax`, `import/unambiguous`, `no-alert`, `no-bitwise`, `no-console`, `no-div-regex`, `no-empty`, `no-empty-function`, `no-eq-null`, `no-implicit-globals`, `no-param-reassign`, `no-plusplus`, `no-proto`, `no-regex-spaces`, `no-restricted-globals`, `no-restricted-imports`, `no-restricted-properties`, `no-sequences`, `no-use-before-define`, `no-var`, `react/button-has-type`, `react/forbid-component-props`, `react/forbid-dom-props`, `react/forbid-elements`, `react/jsx-filename-extension`, `react/jsx-no-literals`, `react/no-danger`, `react/no-multi-comp`, `react/no-unknown-property`, `unicode-bom`, `unicorn/import-style`, `unicorn/no-abusive-eslint-disable`, `unicorn/no-anonymous-default-export`, `unicorn/no-array-for-each`, `unicorn/no-array-reduce`, `unicorn/no-document-cookie`, `unicorn/no-magic-array-flat-depth`, `unicorn/no-process-exit`, `unicorn/no-useless-error-capture-stack-trace`, `unicorn/prefer-modern-math-apis`, `unicorn/prefer-module`, `unicorn/prefer-node-protocol`, `unicorn/prefer-number-properties`

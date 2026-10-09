# Gaps from `@jlg/eslint`

Every rule `@jlg/eslint` (`@jgeschwendt/eslint@0.0.0-canary.0`, its last release) enforced that
this base does not enforce the same way, against **oxlint 1.87**. Resolved, not read off the source:
ESLint's `calculateConfigForFile` on a Next + React + TypeScript probe (every conditional block on)
for `a.js`, `a.ts`, `a.tsx` and the Next route files, diffed against this package's `oxlintrc.jsonc`
(categories, rules, overrides) and `oxlint --rules`. The resolved ESLint side is
`__tests__/fixtures/eslint-baseline.json`. (generated 2026-10-08)

| bucket                                                     | rules |
| ---------------------------------------------------------- | ----: |
| [No oxlint rule — real gaps](#no-oxlint-rule--real-gaps)   |    37 |
| [No oxlint rule — moot](#no-oxlint-rule--moot)             |    25 |
| [In oxlint, off in this base](#in-oxlint-off-in-this-base) |    11 |
| [Options not carried over](#options-not-carried-over)      |     2 |
| [error → warn](#error--warn)                               |    73 |

A rule listed without files applies to every probed file; otherwise the files it was on for.

## No oxlint rule — real gaps

Enforced by `@jlg/eslint`, absent from oxlint 1.87 under any name.

| rule                                                                                                                                                                       | was   | replacement                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------- |
| `@typescript-eslint/member-ordering` (`a.ts`, `a.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`)           | error | —                                                             |
| `@typescript-eslint/naming-convention` (`a.ts`, `a.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`)         | warn  | none — casing is unpoliced beyond `unicorn/filename-case`     |
| `@typescript-eslint/no-unsafe-enum-assignment` (`a.ts`, `a.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`) | error | —                                                             |
| `camelcase`                                                                                                                                                                | error | —                                                             |
| `consistent-this`                                                                                                                                                          | error | —                                                             |
| `import/no-extraneous-dependencies`                                                                                                                                        | error | —                                                             |
| `import/no-import-module-exports`                                                                                                                                          | error | —                                                             |
| `import/no-internal-modules`                                                                                                                                               | error | —                                                             |
| `import/no-relative-packages`                                                                                                                                              | error | —                                                             |
| `import/no-restricted-paths`                                                                                                                                               | error | —                                                             |
| `import/no-unused-modules`                                                                                                                                                 | error | —                                                             |
| `import/no-useless-path-segments`                                                                                                                                          | error | —                                                             |
| `import/order`                                                                                                                                                             | error | oxfmt `sortImports` (formatter-side)                          |
| `no-restricted-syntax`                                                                                                                                                     | error | —                                                             |
| `no-undef-init`                                                                                                                                                            | error | —                                                             |
| `react/boolean-prop-naming`                                                                                                                                                | error | —                                                             |
| `react/destructuring-assignment`                                                                                                                                           | error | —                                                             |
| `react/jsx-no-bind`                                                                                                                                                        | error | `react_perf/jsx-no-new-function-as-prop` (plugin not enabled) |
| `react/jsx-no-leaked-render`                                                                                                                                               | error | —                                                             |
| `react/jsx-sort-props`                                                                                                                                                     | error | —                                                             |
| `react/no-adjacent-inline-elements`                                                                                                                                        | error | —                                                             |
| `react/no-invalid-html-attribute`                                                                                                                                          | error | —                                                             |
| `react/no-typos`                                                                                                                                                           | error | —                                                             |
| `react/no-unused-prop-types`                                                                                                                                               | error | —                                                             |
| `react/prefer-read-only-props`                                                                                                                                             | error | —                                                             |
| `require-atomic-updates`                                                                                                                                                   | error | —                                                             |
| `unicorn/better-regex`                                                                                                                                                     | error | —                                                             |
| `unicorn/consistent-destructuring`                                                                                                                                         | error | —                                                             |
| `unicorn/expiring-todo-comments`                                                                                                                                           | error | —                                                             |
| `unicorn/no-for-loop`                                                                                                                                                      | error | —                                                             |
| `unicorn/no-keyword-prefix`                                                                                                                                                | error | —                                                             |
| `unicorn/no-unnecessary-polyfills`                                                                                                                                         | error | —                                                             |
| `unicorn/no-unused-properties`                                                                                                                                             | error | —                                                             |
| `unicorn/prefer-json-parse-buffer`                                                                                                                                         | error | —                                                             |
| `unicorn/prefer-switch`                                                                                                                                                    | error | —                                                             |
| `unicorn/prevent-abbreviations`                                                                                                                                            | error | —                                                             |
| `unicorn/string-content`                                                                                                                                                   | error | —                                                             |

## No oxlint rule — moot

Absent from oxlint, but nothing is lost on this stack.

| rule                                                                                                                                                             | why                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `@typescript-eslint/no-invalid-this` (`a.ts`, `a.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`) | TS `noImplicitThis` covers it                                   |
| `import/no-unresolved` (`a.js`)                                                                                                                                  | was on for `.js` only (off for TS); TypeScript resolves imports |
| `no-dupe-args` (`a.js`)                                                                                                                                          | a syntax error in strict code; the parser rejects it            |
| `no-invalid-this` (`a.js`)                                                                                                                                       | TS `noImplicitThis` covers TypeScript files                     |
| `no-octal`                                                                                                                                                       | a syntax error in strict code; the parser rejects it            |
| `no-octal-escape`                                                                                                                                                | a syntax error in strict code; the parser rejects it            |
| `react/default-props-match-prop-types`                                                                                                                           | propTypes era; TypeScript props replace it                      |
| `react/forbid-foreign-prop-types`                                                                                                                                | propTypes era; TypeScript props replace it                      |
| `react/forbid-prop-types`                                                                                                                                        | propTypes era; TypeScript props replace it                      |
| `react/jsx-uses-react`                                                                                                                                           | oxlint `no-unused-vars` understands JSX natively                |
| `react/jsx-uses-vars`                                                                                                                                            | oxlint `no-unused-vars` understands JSX natively                |
| `react/no-access-state-in-setstate`                                                                                                                              | class components only                                           |
| `react/no-arrow-function-lifecycle`                                                                                                                              | class components only                                           |
| `react/no-unused-class-component-methods`                                                                                                                        | class components only                                           |
| `react/no-unused-state`                                                                                                                                          | class components only                                           |
| `react/prefer-exact-props`                                                                                                                                       | propTypes era; TypeScript props replace it                      |
| `react/prefer-stateless-function`                                                                                                                                | class components only                                           |
| `react/prop-types`                                                                                                                                               | propTypes era; TypeScript props replace it                      |
| `react/require-default-props`                                                                                                                                    | propTypes era; TypeScript props replace it                      |
| `react/require-optimization`                                                                                                                                     | class components only                                           |
| `react/sort-comp`                                                                                                                                                | class components only                                           |
| `react/sort-default-props`                                                                                                                                       | propTypes era; TypeScript props replace it                      |
| `react/sort-prop-types`                                                                                                                                          | propTypes era; TypeScript props replace it                      |
| `react/static-property-placement`                                                                                                                                | class components only                                           |
| `strict`                                                                                                                                                         | ES modules are always strict                                    |

## In oxlint, off in this base

`nursery` is off by policy (unstable rules); the rest are explicit offs in `oxlintrc.jsonc`.

| rule                                                                                                                                                                      | why off            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `@typescript-eslint/no-unnecessary-condition` (`a.ts`, `a.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`) | `nursery` category |
| `@typescript-eslint/prefer-optional-chain` (`a.ts`, `a.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`)    | `nursery` category |
| `import/export`                                                                                                                                                           | `nursery` category |
| `import/named` (`a.js`)                                                                                                                                                   | `nursery` category |
| `import/no-default-export` (`app/route.ts`, `instrumentation.ts`)                                                                                                         | set `off` here     |
| `no-restricted-exports`                                                                                                                                                   | `nursery` category |
| `no-undef` (`a.js`)                                                                                                                                                       | `nursery` category |
| `no-unreachable-loop`                                                                                                                                                     | `nursery` category |
| `no-useless-assignment`                                                                                                                                                   | `nursery` category |
| `react/function-component-definition`                                                                                                                                     | set `off` here     |
| `react/require-render-return`                                                                                                                                             | `nursery` category |

## Options not carried over

| rule                                                                                                                             | `@jlg/eslint`                                                                                  | here            |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------- |
| `react/jsx-filename-extension`                                                                                                   | `{"extensions": [".jsx", ".tsx"]}`                                                             | oxlint defaults |
| `func-style` (`a.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/robots.ts`, `app/route.ts`, `instrumentation.ts`, `middleware.ts`) | `"declaration", {"allowArrowFunctions": false, "allowTypeAnnotation": false, "overrides": {}}` | oxlint defaults |

`sort-imports` matches in effect: `@jlg/eslint` spelled out the defaults, this base sets only `ignoreDeclarationSort`.

## error → warn

All but one come from one decision: the `restriction` category runs at `warn` (see `oxlintrc.jsonc`). The exception, `@typescript-eslint/prefer-readonly-parameter-types`, is set to `warn` there by name.

`@typescript-eslint/class-methods-use-this`, `@typescript-eslint/explicit-function-return-type`, `@typescript-eslint/explicit-member-accessibility`, `@typescript-eslint/explicit-module-boundary-types`, `@typescript-eslint/no-dynamic-delete`, `@typescript-eslint/no-empty-function`, `@typescript-eslint/no-empty-object-type`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-import-type-side-effects`, `@typescript-eslint/no-invalid-void-type`, `@typescript-eslint/no-namespace`, `@typescript-eslint/no-non-null-asserted-nullish-coalescing`, `@typescript-eslint/no-non-null-assertion`, `@typescript-eslint/no-require-imports`, `@typescript-eslint/no-restricted-types`, `@typescript-eslint/no-use-before-define`, `@typescript-eslint/non-nullable-type-assertion-style`, `@typescript-eslint/prefer-literal-enum-member`, `@typescript-eslint/prefer-readonly-parameter-types`, `@typescript-eslint/promise-function-async`, `@typescript-eslint/use-unknown-in-catch-callback-variable`, `class-methods-use-this`, `complexity`, `default-case`, `import/extensions`, `import/no-amd`, `import/no-commonjs`, `import/no-cycle`, `import/no-dynamic-require`, `import/no-relative-parent-imports`, `import/no-webpack-loader-syntax`, `import/unambiguous`, `no-alert`, `no-bitwise`, `no-console`, `no-div-regex`, `no-empty`, `no-empty-function`, `no-eq-null`, `no-implicit-globals`, `no-param-reassign`, `no-plusplus`, `no-proto`, `no-regex-spaces`, `no-restricted-globals`, `no-restricted-imports`, `no-restricted-properties`, `no-sequences`, `no-use-before-define`, `no-var`, `react/button-has-type`, `react/forbid-component-props`, `react/forbid-dom-props`, `react/forbid-elements`, `react/jsx-filename-extension`, `react/jsx-no-literals`, `react/no-danger`, `react/no-multi-comp`, `react/no-unknown-property`, `unicode-bom`, `unicorn/import-style`, `unicorn/no-abusive-eslint-disable`, `unicorn/no-anonymous-default-export`, `unicorn/no-array-for-each`, `unicorn/no-array-reduce`, `unicorn/no-document-cookie`, `unicorn/no-magic-array-flat-depth`, `unicorn/no-process-exit`, `unicorn/no-useless-error-capture-stack-trace`, `unicorn/prefer-modern-math-apis`, `unicorn/prefer-module`, `unicorn/prefer-node-protocol`, `unicorn/prefer-number-properties`

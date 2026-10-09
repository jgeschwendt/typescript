# `@jlg/eslint` vs `@jlg/oxlint`

> `packages/eslint` was removed 2026-07-19 (recoverable from git history);
> `@jlg/eslint` references herein are historical.

How the two bases differ in shape. The rule-level mapping is README.md ("What
maps from `@jlg/eslint`"), and every rule enforced differently is in GAPS.md;
this chart does not repeat them.

| Dimension            | `@jlg/eslint` (packages/eslint)                                              | `@jlg/oxlint` (packages/oxlint)                                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form                 | JS factory: `config()` detects react/next/ts from consumer's package.json    | Static `oxlintrc.jsonc`, via `extends` or `defineConfig` (which also re-orders the file-named overrides and detects `settings.react.version`); every layer applies unconditionally                                        |
| Philosophy           | Load every plugin's `all` config, subtract prettier-conflicts + curated offs | All categories at `error` (`restriction`→`warn`, `nursery`→off), then curate                                                                                                                                              |
| Plugins              | `@eslint/js`, import, react, unicorn, typescript-eslint (conditional)        | eslint, import, react, typescript, unicorn + **oxc** (new surface); react covers react-hooks; unported rules run as ESLint code through `jsPlugins` (`eslint-js`, `import-js`, `react-js`, `typescript-js`, `unicorn-js`) |
| Type-aware rules     | Yes (`projectService: true`, full typescript-eslint all)                     | **Enabled** via tsgolint — `options.typeAware` (consumer root config) + `oxlint-tsgolint`, repo on TS 7.0; JS plugins get no types                                                                                        |
| File scope           | typescript-eslint on `.ts`/`.tsx`                                            | Every file type, `.mjs`/`.cjs`/`.mts`/`.cts` included; `typescript/*` rules off on JS files                                                                                                                               |
| Formatting conflicts | Subtracted via `eslint-config-prettier`                                      | The five eslint-config-prettier rules oxlint ships (`curly`, `no-unexpected-multiline`, `unicorn/empty-brace-spaces`, `unicorn/no-nested-ternary`, `unicorn/number-literal-case`) off; oxfmt owns format                  |
| Inline directives    | `noInlineConfig: true`, `reportUnusedDisableDirectives`                      | Banned by `inline-config/no-directives` (a directive fails the run); `options.reportUnusedDisableDirectives` belongs in the consumer root                                                                                 |
| JSON linting         | none — `@eslint/json` was a declared but unused dependency                   | none                                                                                                                                                                                                                      |

## Not gaps

1:1 rule-surface parity is a non-goal (reframed 2026-07-19). The eslint config
was maximalist-by-construction — every plugin's `all`, then subtract — so most
of its surface was plugin residue, never authored policy. Oxlint's
categories-at-error is the same maximalist stance expressed natively. Parity
matters for the _authored_ layer — the explicit rule cases and per-file
overrides in `packages/eslint/index.js` — and for rules a consumer relied on;
GAPS.md tracks both.

Different-but-valid design, or separate concerns:

- Runtime detection — static JSONC cannot read the consumer's package.json, so
  the React/Next/TypeScript layers apply to every consumer.
- 3 of typescript-eslint 8.71's 63 type-checked rules have no tsgolint port:
  `naming-convention` (restored as `typescript-js/naming-convention`, without
  its `types` option), `no-unsafe-enum-assignment` (open, GAPS.md) and
  `prefer-destructuring` (core `prefer-destructuring` runs instead)
  (measured 2026-10-09 · `requiresTypeChecking` rules vs oxlint 1.87
  `type_aware`).
- `typescript/prefer-readonly-parameter-types` demoted error→warn; oxc
  `restriction` rules at warn; react-hooks rules gained — deliberate
  divergences.

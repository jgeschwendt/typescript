# `@jlg/eslint` vs `@jlg/oxlint`

> `packages/eslint` was removed 2026-07-19 (recoverable from git history);
> `@jlg/eslint` references herein are historical.

Chart of the eslint→oxlint migration diff (2026-07-19), verified against
`packages/eslint/index.js` and `packages/oxlint/oxlintrc.jsonc`.

| Dimension            | `@jlg/eslint` (packages/eslint)                                              | `@jlg/oxlint` (packages/oxlint)                                                                |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Form                 | JS factory: `config()` detects react/next/ts from consumer's package.json    | Static `oxlintrc.jsonc` via `extends` — no runtime detection                                   |
| Philosophy           | Load every plugin's `all` config, subtract prettier-conflicts + curated offs | All categories at `error` (`restriction`→`warn`, `nursery`→off), then curate                   |
| Plugins              | `@eslint/js`, import, react, unicorn, typescript-eslint (conditional)        | eslint, import, react, typescript, unicorn + **oxc** (new surface); react covers react-hooks   |
| Type-aware rules     | Yes (`projectService: true`, full typescript-eslint all)                     | **Enabled** via tsgolint — `options.typeAware` (root-only) + `oxlint-tsgolint`, repo on TS 7.0 |
| Formatting conflicts | Subtracted via `eslint-config-prettier`                                      | N/A — oxlint ships no formatting rules; oxfmt owns format                                      |
| Inline directives    | `noInlineConfig: true`, `reportUnusedDisableDirectives`                      | **Not ported** — `eslint-disable`-style comments work again                                    |

## Rule-level mapping

| Rule                                                                             | eslint                      | oxlint                                | Status                                                             |
| -------------------------------------------------------------------------------- | --------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| `no-void` (allowAsStatement)                                                     | error                       | error                                 | ported verbatim                                                    |
| `sort-imports` (ignoreDeclarationSort)                                           | error                       | error                                 | ported verbatim                                                    |
| `no-magic-numbers` + options                                                     | warn                        | warn                                  | ported; oxlint honors 5 of 10 option keys, rest inert              |
| `capitalized-comments`, `max-lines(-per-function)`, `no-ternary`, `no-undefined` | off                         | off                                   | ported                                                             |
| `import/no-default-export` (+ named/prefer offs)                                 | error                       | error                                 | ported                                                             |
| `react/jsx-curly-brace-presence`                                                 | error + opts                | error + opts                          | ported verbatim                                                    |
| `react/react-in-jsx-scope`                                                       | off                         | off                                   | ported                                                             |
| Next routing files → `unicorn/filename-case` kebab                               | override                    | override                              | ported                                                             |
| Next/tooling default-export exemptions                                           | findUpSync-gated + per-file | static globs, merged into 2 overrides | ported, coarser (oxlint adds `instrumentation` glob eslint lacked) |
| `one-var: ["error","never"]`                                                     | error                       | —                                     | **dropped** (rule absent)                                          |
| `@typescript-eslint/naming-convention` (default/.tsx/route.ts blocks)            | warn                        | —                                     | **dropped** (rule absent) — biggest gap                            |
| `@typescript-eslint/no-magic-numbers`                                            | warn                        | —                                     | **dropped** (core rule covers via `ignoreNumericLiteralTypes`)     |
| Per-file `func-style` / `import/group-exports` tuning                            | per Next file type          | —                                     | not ported; stay at category severity                              |
| `require-await` off for `instrumentation.ts`                                     | off                         | —                                     | exception not ported                                               |
| oxc `restriction` rules (`no-optional-chaining`, `no-async-await`, …)            | —                           | warn                                  | **new in oxlint**, no eslint analog                                |
| react-hooks rules (`rules-of-hooks`, `hook-use-state`)                           | — (no react-hooks plugin)   | error via react plugin                | **gained**                                                         |
| `prefer-readonly-parameter-types` (type-aware)                                   | error (via ts-eslint `all`) | warn                                  | **retuned** — demoted to warn; impractically strict, kept visible  |

## Open gaps

1:1 rule-surface parity is a non-goal (reframed 2026-07-19). The eslint config
was maximalist-by-construction — every plugin's `all`, then subtract — so most
of its surface was plugin residue, never authored policy. Oxlint's
categories-at-error is the same maximalist stance expressed natively. Parity
matters only for the _authored_ layer: the explicit rule cases and per-file
overrides in `packages/eslint/index.js`.

Authored policy still open:

- Casing policy (`@typescript-eslint/naming-convention` blocks) — the rule is
  absent from both native oxlint and tsgolint. No verified fill path: loading
  typescript-eslint via the jsPlugins alpha inherits its `typescript <6.1`
  peer range, and this repo is on TS 7 (unverified 2026-07-19 · needs a
  jsPlugins spike). Until then, `unicorn/filename-case` is the only casing
  enforcement.
- Inline-directive hardening (`noInlineConfig`,
  `reportUnusedDisableDirectives`) — no config-file equivalent of either
  exists in the configuration schema (verified 2026-07-19);
  `--report-unused-disable-directives` is CLI-only. Partial fill: add the flag
  to the `lint` script.
- Per-Next-file `func-style` / `import/group-exports` tuning and the
  `typescript/require-await` exemption for `instrumentation.ts` — rules exist,
  overrides simply not ported. Trivially closable.
- `one-var: ["error","never"]` — rule absent; re-decide rather than port
  (oxfmt-era value is thin) before reaching for jsPlugins.

Plugin residue, different-but-valid design, or separate concerns (not gaps):

- Runtime detection — static JSONC cannot read the consumer's package.json;
  a design choice, not a defect (`oxlint.config.ts` exists but is
  experimental and forfeits the standalone binary).
- `@typescript-eslint/no-magic-numbers` — absent; the core rule honors 5 of
  10 option keys, TS-specific keys inert.
- 2 of typescript-eslint's 61 type-aware rules missing from tsgolint (59 in
  the catalog, verified 2026-07-19; oxc docs do not name the two).
- `typescript/prefer-readonly-parameter-types` demoted error→warn; oxc
  `restriction` rules at warn; react-hooks rules gained — deliberate
  divergences.
- `@eslint/json` JSON-content linting dropped workspace-wide; oxlint does not
  lint JSON.

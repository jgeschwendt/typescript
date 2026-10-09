# @jlg/oxlint

Shareable [oxlint](https://oxc.rs/docs/guide/usage/linter) base config — the
oxlint successor to the removed `@jlg/eslint`. The base ruleset lives in one
file, `oxlintrc.jsonc`, consumed either programmatically from a TS/JS config
(`import { defineConfig } from "@jlg/oxlint"` — the primary path) or by
`extends`-ing the JSONC directly from a JSON config.

## Consumption

### From a TS/JS config (recommended)

oxlint evaluates an `oxlint.config.{ts,js,mjs}` as real JavaScript, so a config
composes the base programmatically:

```ts
// oxlint.config.ts at your repo root
import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  // Ignores belong in the CONSUMING config — see "Caveats" below.
  ignorePatterns: ['**/*.d.ts'],
  // Type-aware linting belongs in this root config — see "Type-aware linting"
  // below. Requires
  // the `oxlint-tsgolint` package + TypeScript 7+.
  options: { typeAware: true },
  // Your own plugins / rules / overrides compose on top of the base.
  rules: {},
});
```

`defineConfig(config)` returns `{ ...config, extends: [base, ...config.extends] }`
— it prepends the parsed base to `extends` and preserves any `extends` you passed,
so consumer configs still compose. The raw parsed base object is also exported as
`base` for direct access (`import { base } from "@jlg/oxlint"`).

- **`extends` in a JS/TS config takes config OBJECTS, not path strings** (verified
  2026-07-22, oxlint 1.74): the js_config loader resolves each `extends` entry as
  an in-memory config object and rejects a bare string — the opposite of the JSON
  loader, where `extends` is an array of file paths. `defineConfig` handles this;
  it matters only if you hand-build `extends` yourself.
- **Node runtime.** Loading a **TypeScript** config (`oxlint.config.ts`) requires
  Node `^20.19.0 || >=22.18.0` — oxlint relies on Node's native TypeScript
  stripping, which stabilized at those versions (verified 2026-07-22 against
  oxlint 1.74's js_config loader, which emits exactly this requirement on an
  unsupported Node). A plain `.mjs` / `.js` config runs on any oxlint-supported
  Node (`^20.19.0 || >=22.12.0`).

### From a JSON config

`oxlintrc.jsonc` is also published as a subpath and can be pulled into a JSON
config via `extends` — here the entries ARE file paths, resolved relative to the
config's own location:

```jsonc
// .oxlintrc.json at your repo root
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "extends": ["./node_modules/@jlg/oxlint/oxlintrc.jsonc"],
  // Ignores belong HERE, not in the base — see "Caveats" below.
  "ignorePatterns": ["**/*.d.ts"],
  // Type-aware linting belongs in this root config — see "Type-aware
  // linting" below. Requires the `oxlint-tsgolint` package + TypeScript 7+.
  "options": { "typeAware": true },
}
```

## Philosophy

Maximalist, mirroring `@jlg/eslint` (which loads the `all` config of every
plugin and subtracts). Every rule category is turned on — `correctness`,
`pedantic`, `perf`, `style`, `suspicious` at **error**, `restriction` at
**warn** (see below), `nursery` **off** — then a curated set of overrides
retunes individual rules.

Plugins enabled: `eslint` (core), `import`, `oxc`, `react`, `typescript`,
`unicorn`. `react` also covers react-hooks rules (`react/rules-of-hooks`,
`react/hook-use-state`) — oxlint has no separate react-hooks plugin.

## React Compiler rules (oxlint ≥1.80)

oxlint 1.80 added **22 React Compiler rules** to the `react` plugin
([announcement](https://oxc.rs/blog/2026-08-18-react-compiler-support);
inventory confirmed 2026-09-08 via the rule-inventory diff). They arrive with
categories attached, so this config's categories-at-error stance activates all
of them without naming any:

| category      | severity here | rules                                                                                                                                                                                                                  |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `correctness` | error         | `error-boundaries`, `globals`, `immutability`, `incompatible-library`, `preserve-manual-memoization`, `purity`, `refs`, `set-state-in-effect`, `set-state-in-render`, `static-components`, `use-memo`, `void-use-memo` |
| `perf`        | error         | `no-deriving-state-in-effects`                                                                                                                                                                                         |
| `suspicious`  | error         | `capitalized-calls`, `exhaustive-effect-dependencies`, `hooks`, `memo-dependencies`                                                                                                                                    |
| `restriction` | warn          | `invariant`, `rule-suppression`, `syntax`, `todo`, `unsupported-syntax`                                                                                                                                                |

Upstream's own ESLint preset ships five of them **off**
(`no-deriving-state-in-effects`, `capitalized-calls`,
`exhaustive-effect-dependencies`, `hooks`, `memo-dependencies`); this base
**deliberately keeps them on** at their category severity. Evidence they are
tolerable: `jgeschwendt/jlg.io`, a Next.js consumer of this base with
`typeAware: true`, has green CI on `main` at oxlint 1.81 with none of the 22
disabled (runs 2026-09-07/08, verified 2026-09-08).

None of the 22 is named in `oxlintrc.jsonc` — naming even one would raise the
declared peer to `oxlint ^1.80.0` (see the peer-coupling note under
`react/function-component-definition`). A consumer that disagrees turns a rule
off in its **own** root config:

```jsonc
// .oxlintrc.json at your repo root
{
  "extends": ["./node_modules/@jlg/oxlint/oxlintrc.jsonc"],
  "rules": { "react/exhaustive-effect-dependencies": "off" },
}
```

The nursery rule `react/react-compiler` was **removed** in 1.80 in favor of
these 22; it was never named here, so nothing needed removing.

## What maps from `@jlg/eslint`

| `@jlg/eslint` rule                      | oxlint rule                      | notes                                               |
| --------------------------------------- | -------------------------------- | --------------------------------------------------- |
| `no-void` (allowAsStatement)            | `no-void`                        | ported verbatim                                     |
| `sort-imports` (ignoreDeclarationSort)  | `sort-imports`                   | ported verbatim                                     |
| `one-var` (["error","never"])           | `one-var`                        | ported verbatim; rule added in oxlint 1.78          |
| `no-magic-numbers` (warn + options)     | `no-magic-numbers`               | option subset honored (see below)                   |
| `capitalized-comments` off              | `capitalized-comments` off       |                                                     |
| `max-lines` / `max-lines-per-function`  | same, off                        |                                                     |
| `no-ternary` / `no-undefined` off       | same, off                        |                                                     |
| `react/jsx-curly-brace-presence`        | `react/jsx-curly-brace-presence` | ported verbatim                                     |
| `react/react-in-jsx-scope` off          | `react/react-in-jsx-scope` off   |                                                     |
| `import/no-default-export` error        | `import/no-default-export`       | + `no-named-export` / `prefer-default-export` off   |
| Next routing → `unicorn/filename-case`  | same override                    | kebab-case                                          |
| Next default-export files               | `import/no-default-export` off   | layout/page/middleware/instrumentation/robots/route |
| tooling config files                    | `import/no-default-export` off   | eslint/jest/next/postcss/oxlint config              |
| `require-await` off for instrumentation | `typescript/require-await` off   | override on `**/instrumentation.{js,ts}`            |

`no-magic-numbers` is passed the full `@jlg/eslint` option object. oxlint honors
the subset it implements — verified working: `ignore`, `detectObjects`,
`ignoreEnums`, `ignoreArrayIndexes`, `ignoreDefaultValues`. The remaining
TS-specific keys (`ignoreNumericLiteralTypes`, `ignoreReadonlyClassProperties`,
`ignoreTypeIndexes`, `ignoreClassFieldInitialValues`) are inert but kept for
parity and forward-compatibility.

## What was DROPPED

**The full list is [`GAPS.md`](./GAPS.md)** — every rule `@jlg/eslint` enforced
that this base does not enforce the same way, resolved per file type against
oxlint 1.87 (37 real gaps with no oxlint rule, among them `import/order`; 25
absent but moot; 11 present but off here; 2 options not carried over; 73
error→warn). The notes below add what the list can't say:

- **`@typescript-eslint/naming-convention`** → `typescript/naming-convention`
  **absent**. This is the biggest gap: `@jlg/eslint` carried extensive
  naming-convention blocks (default/type/parameter/enum-member casing, plus
  per-context tuning for `.tsx`, `route.ts`, etc.). None of it ports. Casing is
  otherwise unpoliced except `unicorn/filename-case`.
- **`@typescript-eslint/no-magic-numbers`** → `typescript/no-magic-numbers`
  **absent**. Only the core `no-magic-numbers` exists; TS number literals in
  type positions rely on the core rule's `ignoreNumericLiteralTypes` /
  `ignoreEnums` options instead.
- **Per-file `func-style` and `import/group-exports` overrides** — both rules
  _exist_ in oxlint, but `@jlg/eslint`'s fine-grained per-route-file tuning of
  them (e.g. `func-style` declaration-vs-expression by Next file type,
  `group-exports: off` for `route`/`page`) was **not** ported. They remain at
  their global category severity. Retune per-file here if needed.

`one-var` left this list on 2026-09-08: oxlint implemented it in 1.78 and the
`["error", "never"]` policy is now ported (see the mapping table above). The
`@typescript-eslint/require-await` exemption for `instrumentation.ts` is ported
too, as an override on `**/instrumentation.{js,ts}`.

## Type-aware linting

Type-aware `typescript/*` rules are **enabled** (as of 2026-07-19, TypeScript
7.0). oxlint's type-aware engine, tsgolint, is a native binary that requires:

1. the **`oxlint-tsgolint`** package installed (a root devDependency here), and
2. **TypeScript 7.0+** — tsgolint runs the native `typescript-go` type checker.

The two move together: oxlint 1.82.0 declares
`peerDependencies: { "oxlint-tsgolint": ">=7.0.2001" }`, and the pairing oxlint
1.82.0 + oxlint-tsgolint 7.0.2001 + typescript 7.0.2 was probed directly —
`typescript/no-floating-promises` fires (verified 2026-09-08 · direct probe). An
oxlint-tsgolint older than the declared peer breaks type-aware linting
_silently_ ("Failed to find tsgolint executable"), so probe a type-aware rule
after any bump rather than trusting a green run.

It is switched on with `"options": { "typeAware": true }` — equivalent to the
`--type-aware` CLI flag. Set it in **your root config** (`oxlint.config.ts` or
`.oxlintrc.json`), never in this shared base: the configuration schema documents
every `options` key as "Only supported in the root configuration file". An
extended config's `options` were _observed_ to take effect at oxlint 1.78, 1.80
and 1.82 (probed 2026-09-08 · `typeAware` and `reportUnusedDisableDirectives` both
fired from a config reached only via `extends`), but this base does not rely on
behavior the schema calls unsupported — an upstream fix would silently switch
type-aware linting off for every consumer. The base file instead
retunes the type-checked rules (see the "type-aware retuning" section in
`oxlintrc.jsonc`); currently `typescript/prefer-readonly-parameter-types` is
demoted from error to **warn** — it demands `readonly` on every non-primitive
parameter (including idiomatic destructured callback args) and is impractically
strict on the React/Next stack this config targets.

## Caveats

- **Rule-name / plugin footgun.** Two ways a rule can quietly stop doing its job
  (re-verified 2026-09-08 · probe, oxlint 1.82):
  - An unknown/misspelled rule _name_, or an unknown _plugin_ name, makes oxlint
    reject the **entire** config — `Failed to parse … Rule 'x' not found in
    plugin 'y'` (or `Unknown plugin`), exit 1, nothing lints — the same when the
    config is consumed via `extends`. Loud but blunt: every rule the config
    defined stops applying, and downstream it surfaces as a cryptic parse
    failure, not "you typo'd a rule".
  - A _valid_ rule whose plugin is **not** in `plugins` (e.g. `unicorn/no-null`
    while `plugins` omits `unicorn`) parses fine, exits 0, and simply never runs.
    This one is genuinely silent.

  Both are enforced by [`__tests__/rule-existence.test.js`](#testing) rather than
  by eyeball — a typo, a rule an oxlint bump renames/removes, or a rule orphaned
  from its plugin fails the suite by name. Historically this bullet claimed an
  unknown rule name was a silent no-op; oxlint now rejects the whole config
  instead. Verify new rule names against `oxlint --rules --format json` (the test
  does this for you).

- **Unused-directive reporting is a root-config concern too.** oxlint reports
  stale `// oxlint-disable` / `// eslint-disable` comments either via the CLI flag
  `--report-unused-disable-directives` (bare flag reports at **warn**;
  `--report-unused-disable-directives-severity=error` for error) or via
  `options.reportUnusedDisableDirectives: "warn" | "error"` in the root config
  (key present and honored at oxlint 1.78, 1.80 and 1.82 — probed 2026-09-08;
  the schema marks it root-only and says CLI flags take precedence). This base
  sets neither, for the same reason it never sets `typeAware`; this repo's own
  `lint` script passes the flag.
- **`restriction` is `warn`, not `error`.** oxlint's `restriction` category is
  dominated by the `oxc` plugin's language-feature bans
  (`no-optional-chaining`, `no-rest-spread-properties`, `no-async-await`, …)
  which have no analog in the `@jlg/eslint` stack and would false-positive on
  idiomatic modern JS/TS. Kept at `warn` so they stay visible; promote
  individual restriction rules to `error` in `rules` as desired.
- **`ignorePatterns` must live in the consuming root config.** oxlint roots an
  extended config's ignore globs at _that config's own directory_, so patterns
  set in this shared file would only ever match files under
  `node_modules/@jlg/oxlint`. Put `**/*.d.ts` and friends in your root config
  (`oxlint.config.ts` or `.oxlintrc.json`).
- **Namespaces differ from ESLint.** `@typescript-eslint/x` → `typescript/x`;
  core rules stay bare; `import/x`, `unicorn/x`, `react/x` as-is.

## Testing

`bun run --filter '@jlg/oxlint' test` runs Bun's built-in test runner
(`bun test`) over `__tests__/` (migrated from `node --test` 2026-07-23). The first two suites are driven off oxlint's
own `oxlint --rules --format json` catalog and `configuration_schema.json` and
guard the two ways an oxlint version bump can change this config's behavior
invisibly; the third guards the JS entry's composition contract:

- **`rule-existence.test.js`** — the footgun guard. Fails, naming the offender,
  if any rule in `oxlintrc.jsonc` (top-level `rules` or any `overrides[].rules`)
  is not a real oxlint rule, if any entry in `plugins` is not a real plugin, or
  if a rule's plugin is not enabled in `plugins`. See the "Rule-name / plugin
  footgun" caveat for why each of those otherwise slips through.
- **`rule-inventory.test.js`** — the update-review gate. Snapshots every rule in
  the plugins this config enables (`scope/value`, category, `type_aware`).
  Because the config turns whole categories on at `error`, a rule an oxlint bump
  **adds** to `correctness` / `pedantic` / `perf` / `style` / `suspicious`
  silently becomes an error for every consumer the moment they upgrade — the
  snapshot diff surfaces it at review time instead.
- **`define-config.test.js`** — the JS-entry contract. Asserts `defineConfig`
  prepends `base` as the first `extends` entry, appends any consumer-supplied
  `extends` after it, composes the base even with no argument, does not mutate
  the caller's config, and that the exported `base` is byte-for-byte the parsed
  `oxlintrc.jsonc` (so JS and raw-JSONC consumers get an identical ruleset).

After an **intentional** oxlint bump, review the inventory diff, then regenerate
(`--update-snapshots`, or the `-u` short form, verified against bun 1.3.14):

```sh
bun run --filter '@jlg/oxlint' test --update-snapshots
```

The catalog the tests read comes from the `oxlint` that Node resolution finds
from `packages/oxlint/__tests__/` — `packages/oxlint/node_modules/oxlint` first,
the hoisted root copy second. Bumping only the root `devDependencies.oxlint`
therefore leaves the tests, and a regenerated snapshot, on the **old** catalog
with a silent no-diff; bump `packages/oxlint/package.json`'s `devDependencies.oxlint`
in the same change and confirm `packages/oxlint/node_modules/oxlint/package.json`
reports the new version before regenerating. (observed 2026-09-08 · the 1.75 → 1.82
bump regenerated a no-diff snapshot until the package-level pin moved)

Snapshots live in Bun's `__snapshots__/` directory next to the tests
(`__tests__/__snapshots__/*.snap`, jest-format) and are committed.

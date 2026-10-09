# @jlg/oxlint

Shareable [oxlint](https://oxc.rs/docs/guide/usage/linter) base config — the
oxlint successor to the removed `@jlg/eslint`. The base ruleset lives in one
file, `oxlintrc.jsonc`, consumed either programmatically from a TS config
(`import { defineConfig } from "@jlg/oxlint"` — the primary path) or by
`extends`-ing the JSONC directly from a JSON config.

## Consumption

### From a TS config (recommended)

oxlint auto-discovers an `oxlint.config.ts` (or `.mts`) and evaluates it as
real JavaScript; an `oxlint.config.{js,mjs,cjs,cts}` loads only when named
with `-c` (verified 2026-10-09 · probe, oxlint 1.87):

```ts
// oxlint.config.ts at your repo root
import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  // Ignores belong in the CONSUMING config — see "Caveats" below.
  ignorePatterns: ['**/*.d.ts'],
  // Type-aware linting belongs in this root config — see "Type-aware linting"
  // below. Requires the `oxlint-tsgolint` package + TypeScript 7+.
  options: { typeAware: true },
  // Your own plugins / rules / overrides compose on top of the base.
  rules: {},
});
```

`defineConfig(config)` returns your config with three things added:

- **`extends: [base, ...config.extends]`** — the parsed base first, any
  `extends` you passed after it.
- **`overrides: [...config.overrides, ...fileNamed]`** — the base's overrides
  scoped by file name (Next routing files, `route.ts` naming, tooling
  configs) re-appended after yours, so they beat a consumer `**/*.tsx`
  override as they did under `@jlg/eslint`. The base's extension-only
  overrides (`**/*.<ext>`) stay under yours.
- **`settings`** in the root config, where oxlint reads them, with
  `settings.react.version` detected from the `react/package.json` your project
  resolves (eslint-plugin-react's `"detect"` is rejected by oxlint). Your own
  `settings` win.

The base is also exported as `base` (`import { base } from "@jlg/oxlint"`): the
parsed `oxlintrc.jsonc`, except that its `jsPlugins` paths are absolutized —
in a JS config the base has no file of its own to resolve them against.

- **`extends` in a JS/TS config takes config OBJECTS, not path strings**:
  oxlint rejects a string with "`extends[0]` must be a config object
  (strings/paths are not supported)" — the opposite of the JSON loader, where
  `extends` is an array of file paths (verified 2026-10-09 · probe, oxlint
  1.87). `defineConfig` handles this; it matters only if you hand-build
  `extends` yourself.
- **Runtime.** Loading a **TypeScript** config requires Node
  `^20.19.0 || >=22.18.0` — oxlint relies on Node's native TypeScript
  stripping (verified 2026-07-22 against oxlint 1.74's js_config loader,
  which emits exactly this requirement on an unsupported Node). `bun run`
  and `bunx` honor the bin's node shebang; `bun --bun oxlint` evaluates the
  config — and every JS plugin — in Bun instead (verified 2026-10-09 · probe).
  Both runtimes are tested (see [Testing](#testing)).

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
  // eslint-plugin-react needs a semver; it warns on every run without one.
  "settings": { "react": { "version": "19.2.0" } },
}
```

What the JS entry does for you, a JSON consumer does by hand:

- **`settings` go in your root config.** An extended config's top-level
  `settings`, `env` and `globals` are dropped (verified 2026-10-09 · probe);
  the base carries no `settings` and puts `env.node` in an override, which
  survives `extends`.
- **Your overrides beat the base's file-named ones.** An `extends` cannot
  re-order them, so a consumer `**/*.tsx` override wins over the Next
  routing-file exemptions; scope yours to avoid those files.

## Philosophy

Maximalist, mirroring `@jlg/eslint` (which loads the `all` config of every
plugin and subtracts). Every rule category is turned on — `correctness`,
`pedantic`, `perf`, `style`, `suspicious` at **error**, `restriction` at
**warn** (see below), `nursery` **off** — then a curated set of overrides
retunes individual rules.

Plugins enabled: `eslint` (core), `import`, `oxc`, `react`, `typescript`,
`unicorn`. `react` also covers react-hooks rules (`react/rules-of-hooks`,
`react/hook-use-state`) — oxlint has no separate react-hooks plugin. Rules
oxlint never ported run through `jsPlugins` (see
[Restored through JS plugins](#restored-through-js-plugins)).

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

None of the 22 is named in `oxlintrc.jsonc`, so none sets a floor under the
`oxlint` peer (see the peer-coupling note under
`react/function-component-definition`). A consumer that disagrees turns a rule
off in its **own** root config:

```jsonc
// .oxlintrc.json at your repo root
{
  "extends": ["./node_modules/@jlg/oxlint/oxlintrc.jsonc"],
  "rules": { "react/exhaustive-effect-dependencies": "off" },
}
```

## What maps from `@jlg/eslint`

| `@jlg/eslint`                                                               | oxlint                                                                                                                           | notes                                                                                                                                                       |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-void` (allowAsStatement)                                                | `no-void`                                                                                                                        | ported verbatim                                                                                                                                             |
| `sort-imports` (ignoreDeclarationSort)                                      | `sort-imports`                                                                                                                   | ported verbatim                                                                                                                                             |
| `one-var` (["error","never"])                                               | `one-var`                                                                                                                        | ported verbatim; rule added in oxlint 1.78                                                                                                                  |
| `no-magic-numbers` (warn + options)                                         | `no-magic-numbers`                                                                                                               | same option object; every key honored (see below)                                                                                                           |
| `capitalized-comments` off                                                  | `capitalized-comments` off                                                                                                       |                                                                                                                                                             |
| `max-lines` / `max-lines-per-function`                                      | same, off                                                                                                                        |                                                                                                                                                             |
| `no-ternary` / `no-undefined` off                                           | same, off                                                                                                                        |                                                                                                                                                             |
| `react/jsx-curly-brace-presence`                                            | `react/jsx-curly-brace-presence`                                                                                                 | ported verbatim                                                                                                                                             |
| `react/react-in-jsx-scope` off                                              | `react/react-in-jsx-scope` off                                                                                                   |                                                                                                                                                             |
| `import/no-default-export` error                                            | `import/no-default-export`                                                                                                       | + `no-named-export` / `prefer-default-export` off                                                                                                           |
| `eslint-config-prettier` offs                                               | `curly`, `no-unexpected-multiline`, `unicorn/empty-brace-spaces`, `unicorn/no-nested-ternary`, `unicorn/number-literal-case` off | the eslint-config-prettier 10.1.8 rules oxlint ships; oxfmt owns layout                                                                                     |
| `globals.node`                                                              | `env.node` override on every file                                                                                                | a top-level `env` would be dropped through `extends`                                                                                                        |
| typescript-eslint on `.ts`/`.tsx` only                                      | every category-enabled `typescript/*` rule off on `**/*.{cjs,js,jsx,mjs}`                                                        | `rule-existence.test.js` keeps the list complete                                                                                                            |
| TS block: core twins off                                                    | `no-implied-eval`, `prefer-promise-reject-errors`, `require-await` off on TS                                                     | the type-aware `typescript/*` versions stay on                                                                                                              |
| TS block: `import/consistent-type-specifier-style`, `import/extensions` off | same, off on TS                                                                                                                  |                                                                                                                                                             |
| `noInlineConfig: true`                                                      | `inline-config/no-directives` error                                                                                              | see [Inline directives](#inline-directives)                                                                                                                 |
| Next routing → `unicorn/filename-case`                                      | same override                                                                                                                    | kebab-case                                                                                                                                                  |
| Next default-export files                                                   | `import/no-default-export` off                                                                                                   | layout/page/middleware/robots, as `@jlg/eslint` — plus instrumentation/route, which `@jlg/eslint` did not exempt (kept wider by owner decision, 2026-10-09) |
| Next route/instrumentation/middleware, layout/page                          | `import/group-exports` off                                                                                                       | `**/{instrumentation,middleware,route}.{js,ts}`, `**/{layout,page}.{jsx,tsx}`                                                                               |
| `require-await` off for instrumentation                                     | `require-await` + `typescript/require-await` off                                                                                 | override on `**/instrumentation.{js,ts}`                                                                                                                    |
| tooling config files (preferDefaultExports)                                 | `import/no-default-export` off, `import/no-named-export` error                                                                   | `./{eslint,jest,next,oxfmt,oxlint,postcss}.config.{cjs,cts,js,mjs,mts,ts}` — root only; nested ones are app code                                            |

`no-magic-numbers` is passed the full `@jlg/eslint` option object, and oxlint
honors every key: flipping each of the ten (`detectObjects`, `enforceConst`,
`ignore`, `ignoreArrayIndexes`, `ignoreClassFieldInitialValues`,
`ignoreDefaultValues`, `ignoreEnums`, `ignoreNumericLiteralTypes`,
`ignoreReadonlyClassProperties`, `ignoreTypeIndexes`) changes the output
(verified 2026-10-09 · toggle probe, oxlint 1.87). Dropping one changes
behavior.

A `./` prefix anchors an override glob at the root config's directory, while a
bare name matches at any depth (verified 2026-10-09 · probe) — so the tooling
override matches only the root's config files, as `@jlg/eslint`'s root-relative
globs did.

`.mjs`, `.cjs`, `.mts` and `.cts` files get the full base. `@jlg/eslint` linted
fewer of them; the widening is deliberate.

oxlint also skips `.gitignore`d files, which ESLint 9's flat config linted unless
ignored explicitly, and the recommended consumer ignore `**/*.d.ts` drops
declaration files the old base linted (verified 2026-10-09 · audit probe).

`@jlg/eslint` also exported `constants`, `preferDefaultExports`,
`preferNamedExports` and `config.findPackageJson`; nothing consumed them and this
package does not carry them (measured 2026-10-09 · `rg` across every grove repo).

## What was DROPPED

**The full list is [`GAPS.md`](./GAPS.md)** — every rule `@jlg/eslint` enforced
that this base does not enforce the same way, resolved per file type against
oxlint 1.87 (42 real gaps with no oxlint rule, 37 of them restored and 5 open;
25 absent but moot; 11 present but off here; 4 with changed options; 73
error→warn). The notes below add what the list can't say:

- **`@typescript-eslint/no-magic-numbers`** → `typescript/no-magic-numbers`
  **absent**. The core `no-magic-numbers` takes the TS-specific keys
  (`ignoreNumericLiteralTypes`, `ignoreTypeIndexes`, …) instead.
- **Per-file `func-style`** — `@jlg/eslint` tuned it per Next file type
  (declaration in `.tsx` and the route files, `namedExports: "expression"` in
  layout/page). Not in the base; it runs at its category severity with
  oxlint's defaults, so a Next consumer ports the matrix itself (jlg.io does).
- **Open real gaps** — `@typescript-eslint/no-unsafe-enum-assignment` (no
  types in JS plugins), and on JS files `consistent-return`, `dot-notation`,
  `no-octal` and `no-octal-escape` (GAPS.md says how each would come back).

## Restored through JS plugins

oxlint's `jsPlugins` run ESLint rule code inside oxlint, so 42 of the rules
the migration dropped (GAPS.md) run again as the **original** rules, at the
severities and options `@jlg/eslint` resolved — except `import-js/order`,
which takes jlg.io's pre-2022 alphabetized config (plus an `internal` group
for `@/`), since `@jlg/eslint`'s defaults never sorted, and
`react-js/require-default-props`, which takes `functions:
"defaultArguments"` because React 19 ignores `defaultProps` on function
components. A 43rd rule, `inline-config/no-directives`, is the directive ban.
`oxlint --fix` applies the fixable ones:

| plugin          | source                                                               | rules |
| --------------- | -------------------------------------------------------------------- | ----: |
| `import-js`     | `plugins/import-js.mjs` — `eslint-plugin-import`                     |    10 |
| `react-js`      | `plugins/react-js.mjs` — `eslint-plugin-react`                       |    12 |
| `unicorn-js`    | `plugins/unicorn-js.mjs` — `eslint-plugin-unicorn` (pinned 60.0.0)   |    12 |
| `eslint-js`     | `plugins/eslint-js.mjs` — ESLint core rules                          |     6 |
| `typescript-js` | `plugins/typescript-js.mjs` — `member-ordering`, `naming-convention` |     2 |
| `inline-config` | `plugins/inline-config.mjs` — the directive ban                      |     1 |

(measured 2026-10-09 · rules named in `oxlintrc.jsonc`)

The `-js` aliases exist because `import`, `react` and `unicorn` collide with
oxlint's native plugins. Disable or retune one like any rule
(`"unicorn-js/prevent-abbreviations": "off"`). Two run on JS files only,
where TypeScript checks nothing without `allowJs`/`checkJs`:
`import-js/no-unresolved` and `eslint-js/no-invalid-this`.

Five are loaded but check nothing without options, as under `@jlg/eslint`:
`eslint-js/no-restricted-syntax` (selectors), `import-js/no-restricted-paths`
(`zones`), `import-js/no-unused-modules` (`unusedExports`/`missingExports`,
plus an `.eslintrc` stub beside it, eslint-plugin-import#3079),
`react-js/boolean-prop-naming` (`rule`) and `unicorn-js/string-content`
(`patterns`). Give them options to turn them on.

How the layer is built, each part guarded by `__tests__/js-plugins.test.js`:

- **Local entries.** Every `jsPlugins` entry is a `./plugins/*.mjs` path.
  `import-js`, `react-js` and `unicorn-js` are wrappers: a bare specifier in an
  extended config resolves from the consumer's symlinked
  `node_modules/@jlg/oxlint`, which holds none of this package's dependencies
  under an isolated install, while the wrapper's own import resolves from its
  real path.
- **Host adapter.** `plugins/host.mjs` wraps every ESLint-code plugin: each
  file gets a fresh context and `sourceCode` (oxlint reuses one per rule,
  which leaked eslint-plugin-react's `@jsx` pragma and eslint-module-utils'
  once-per-file resolve errors between files); ESLint's `getJSDocComment` is
  restored (oxlint throws "not supported"; `no-invalid-this` and
  eslint-plugin-react's `@extends` detection need it); and a throwing listener
  reports `Rule crashed under oxlint's JS plugin host: <message>` for that
  rule alone, instead of oxlint dropping every JS-plugin report on the file.
- **Parser.** `import-js` hands eslint-module-utils `@typescript-eslint/parser`
  for reading imported modules: oxlint leaves `languageOptions.parser.parse`
  unimplemented.
- **TypeScript 7.** typescript-eslint throws on TS 7, which ships no JS API, so
  `plugins/typescript6.mjs` (shared by `typescript-js` and `import-js`) points
  only typescript-eslint's `import 'typescript'` at `@typescript/typescript6` —
  TypeScript's sanctioned bridge — through `module.registerHooks` on node and
  `Module._resolveFilename` on bun, whose `Bun.plugin` never sees a CommonJS
  `require()` from `node_modules`. The repo, `tsc` and tsgolint stay on 7.
- **Alpha.** JS plugins sit outside oxlint's semver, so `oxlint` is pinned
  exactly (peer and dev) — bump it deliberately and let the test speak.
- **unicorn is pinned to 60.0.0**, the version `@jlg/eslint` resolved for
  jlg.io; every `unicorn-js` rule reports with its old semantics on node and
  bun. Later majors drift: 66 stubs `better-regex` and
  `prefer-json-parse-buffer`, defaults `expiring-todo-comments` to
  `checkDates: false` and narrows `consistent-destructuring`; 67 crashes at
  load, 68–76 fail options validation on their own
  `logical-assignment-operators`, and 77 loads but reports nothing (verified
  2026-10-08 · bisect, oxlint 1.87).

The test packs the package, installs the tarball next to `typescript@7` and
the peer `oxlint` under both bun linkers, lints a fixture through both
entries on node and bun, and fails unless every configured `jsPlugins` rule
reports. It needs the network or a warm bun cache.

## Inline directives

`inline-config/no-directives` stands in for `@jlg/eslint`'s
`noInlineConfig: true`, which oxlint has no setting for
(`options.respectEslintDisableDirectives: false` covers only `eslint-*`
comments). It reports every `eslint-*` and `oxlint-*` `disable`, `enable`,
`disable-line`, `disable-next-line` and `eslint-env` comment, line or block,
plus block `eslint`/`oxlint` inline rule config and `global`, `globals` and
`exported` comments. A directive still suppresses what it names — the ban
makes the run fail instead of making it inert.

A directive whose range covers its own comment would silence its own report:
a block `disable` that is blanket or names `inline-config/*`, or a
`disable-line`. Those throw, so the run fails with `Error running JS plugin …
would suppress its own report` and every JS-plugin report on that file is
dropped; with `-f unix` this prints as an empty `file:0:0:  [Warning]` line,
but the exit code is still 1. A line `// oxlint-disable` starts after its own
line, so it is reported normally. (verified 2026-10-09 · probe, oxlint 1.87)

With every directive an error, unused-directive reporting has little left to
catch.

## Engine differences

The same rule can decide differently in oxlint. Each of these was found by a
differential probe against `@jlg/eslint`, and none has an oxlint option
(observed 2026-10-09 · differential probes, oxlint 1.87 vs the `@jlg/eslint`
stack); the last two are this base's own config, kept as is:

- **`id-length`** flags type-literal keys (`{ a: 1 }`), interface members
  (`m()`) and function-type params (`(v: string) => void`), which ESLint
  never visited. An override's `id-length` options replace the base's whole
  object, so restate `checkGeneric: false` in each one.
- **`react/jsx-max-depth`** counts depth through `{items.map(() => <jsx />)}`,
  where eslint-plugin-react restarts — re-derive any `max` tuned under ESLint.
- **`unicorn/consistent-function-scoping`** disagrees with unicorn 60 both
  ways. `unicorn-js/consistent-function-scoping` (with the native rule off)
  would match it exactly.
- **`no-shadow`** misses a shadowed import used only as a type;
  `ignoreTypeValueShadow: false` would also flag the type/value name pairs
  typescript-eslint allowed.
- **Import resolution**: oxlint resolves TypeScript targets, so
  `import/no-relative-parent-imports` and similar fire on TS imports the old
  node resolver skipped.
- Smaller ones: `react/hook-use-state` ignores `[, setX]`; `react/no-multi-comp`
  misses nested, ALL-CAPS and object-literal components;
  `unicorn/text-encoding-identifier-case` exempts `TextDecoder`;
  `unicorn/prefer-spread` does not flag `split('')`;
  `import/max-dependencies` skips side-effect imports; `unicorn/no-array-reduce`
  flags a parenthesized simple operation; `typescript/no-unsafe-member-access`
  checks JSX member tags (`<m.div>`); `vars-on-top` no longer flags `var` in
  `declare global`.
- **Double reports**: core `no-throw-literal` and `typescript/only-throw-error`
  both report a thrown literal in a TS file under `typeAware` (typescript-eslint
  replaced the core rule; verified 2026-10-09 · probe).
- **Without `typeAware`** a TS file runs neither version of `no-implied-eval`,
  `prefer-promise-reject-errors` or `require-await`: the base turns the core
  rules off on TS in favor of the type-aware ones.

And from oxlint's JS plugin host:

- **Scripts.** A `.js`/`.jsx`/`.ts`/`.tsx` file with no `import`/`export`
  parses as `sourceType: "script"` (the configuration schema has no
  `sourceType`; verified 2026-10-09):
  `unicorn-js/no-unused-properties` skips its top level, eslint-plugin-react's
  component detection can crash on some script-mode patterns (contained to
  that rule by `host.mjs`), and an octal literal or escape passes in a JS
  script. Add `export {}` to such a file to lint it as a module.
- **`importKind` on `.js`.** oxc sets `importKind` on JS imports, so
  `import-js/order` ranks a `require` and an `import` of the same module
  apart, and `unicorn-js/no-keyword-prefix` reports a shorthand import
  specifier twice.
- **`exports` maps.** `import-js/no-unresolved` (eslint-module-utils' node
  resolver) ignores package `exports`, so it false-positives on exports-only
  packages and on `bun:` builtins in JS files. Relax it with `ignore` patterns
  in a JS-files override — an override, because the base's own JS-files
  override beats your top-level `rules`.
- **Pragmas.** eslint-plugin-react reads `@jsx <word>` in any comment as a JSX
  pragma.
- **Settings.** JS plugins see `settings` only from the root config, or from
  the nested config governing the file. Without `settings.react.version`
  eslint-plugin-react warns "React version not specified" on every run.
- **One fix pass.** ESLint re-runs fixes until a file settles; `oxlint --fix`
  applies one pass, so re-run it until the output is stable (`import-js/order`
  can take several; jlg.io took three, observed 2026-10-08).
- **No types.** JS plugins get no type information. `naming-convention` asks
  for parser services only to read compiler options; `typescript-js` supplies
  empty ones and refuses the type-dependent `types` option.
- **Columns** count UTF-8 bytes after non-ASCII text, oxlint-wide (verified
  2026-10-09 · probe).

## Composing in a consumer

Facts about oxlint's config merging that a consumer config has to work with
(verified 2026-10-09 · probes, oxlint 1.87):

- **An extended config's overrides beat the extending config's top-level
  `rules`.** A consumer rule meant to change what a base override sets — on
  TS files (`**/*.{cts,mts,ts,tsx}`), JS files, Next or tooling files — must
  itself be an override.
- **Enabling a native plugin**, even through an override's `plugins`, puts
  every rule of that plugin under the root `categories`; overrides take no
  `categories` (schema: `env`, `excludeFiles`, `files`, `globals`,
  `jsPlugins`, `plugins`, `rules`). To match a narrow legacy set — jlg.io's
  `jsx-a11y` — name every other rule of the plugin off.
- **Nested configs** replace the root for their subtree, so each needs an
  `extends`. `ignorePatterns` and `settings` do not carry through `extends`,
  and override globs are relative to the nested config's directory.

## Type-aware linting

Type-aware `typescript/*` rules are **enabled** (as of 2026-07-19, TypeScript
7.0). oxlint's type-aware engine, tsgolint, is a native binary that requires:

1. the **`oxlint-tsgolint`** package installed (a root devDependency here), and
2. **TypeScript 7.0+** — tsgolint runs the native `typescript-go` type checker.

The two move together: oxlint 1.87.0 declares
`peerDependencies: { "oxlint-tsgolint": ">=7.0.2003" }`, and the pairing oxlint
1.87.0 + oxlint-tsgolint 7.0.2003 was probed directly —
`typescript/no-floating-promises` fires (verified 2026-10-09 · direct probe). An
oxlint-tsgolint older than the declared peer breaks type-aware linting
_silently_ ("Failed to find tsgolint executable"), so probe a type-aware rule
after any bump rather than trusting a green run.

It is switched on with `"options": { "typeAware": true }` — equivalent to the
`--type-aware` CLI flag. Set it in **your root config** (`oxlint.config.ts` or
`.oxlintrc.json`), never in this shared base: the configuration schema documents
every `options` key as "Only supported in the root configuration file". An
extended config's `options` were _observed_ to take effect at oxlint 1.78, 1.80
and 1.82 (probed 2026-09-08 · `typeAware` and `reportUnusedDisableDirectives` both
fired from a config reached only via `extends`) and still do at 1.87 (observed
2026-10-09 · `reportUnusedDisableDirectives`, through JSON and JS-object
`extends`), but this base does not rely on behavior the schema calls
unsupported — an upstream fix would silently switch type-aware linting off for
every consumer. The base file instead retunes the type-checked rules (see the
"type-aware retuning" section in `oxlintrc.jsonc`); currently
`typescript/prefer-readonly-parameter-types` is demoted from error to **warn** —
it demands `readonly` on every non-primitive parameter (including idiomatic
destructured callback args) and is impractically strict on the React/Next stack
this config targets.

## Caveats

- **Rule-name / plugin footgun.** Two ways a rule can quietly stop doing its job
  (re-verified 2026-10-09 · probe, oxlint 1.87):
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
  from its plugin fails the suite by name. Verify new rule names against
  `oxlint --rules --format json` (the test does this for you).

- **Unused-directive reporting is a root-config concern too.** Set
  `options.reportUnusedDisableDirectives: "warn" | "error"` in your root config
  (the schema marks it root-only). Do not also pass the bare CLI flag
  `--report-unused-disable-directives`: it overrides the key down to **warn**,
  so an `"error"` config exits 0 (verified 2026-10-09 · probe, oxlint 1.87;
  `--report-unused-disable-directives-severity=error` is the flag form of
  error). This base sets neither, for the same reason it never sets
  `typeAware`; this repo's root `.oxlintrc.json` sets the key to `"error"` and
  its `lint` script is plain `oxlint`.
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
(`bun test`) over `__tests__/`. The first two suites are driven off oxlint's
own `oxlint --rules --format json` catalog and `configuration_schema.json` and
guard the two ways an oxlint version bump can change this config's behavior
invisibly; the rest lint real files end to end:

- **`rule-existence.test.js`** — the footgun guard. Fails, naming the offender,
  if any rule in `oxlintrc.jsonc` (top-level `rules` or any `overrides[].rules`)
  is not a real oxlint rule, if any entry in `plugins` is not a real plugin, or
  if a rule's plugin is not enabled in `plugins`. See the "Rule-name / plugin
  footgun" caveat for why each of those otherwise slips through. Also fails if
  a category-enabled `typescript/*` rule is left on for JS files.
- **`rule-inventory.test.js`** — the update-review gate. Snapshots every rule in
  the plugins this config enables (`scope/value`, category, `type_aware`).
  Because the config turns whole categories on at `error`, a rule an oxlint bump
  **adds** to `correctness` / `pedantic` / `perf` / `style` / `suspicious`
  silently becomes an error for every consumer the moment they upgrade — the
  snapshot diff surfaces it at review time instead.
- **`define-config.test.js`** — the JS-entry contract. Asserts `defineConfig`
  prepends `base` as the first `extends` entry, appends any consumer-supplied
  `extends` after it, composes the base even with no argument, does not mutate
  the caller's config, re-appends the base's file-named overrides after the
  consumer's, and sets `settings.react.version` from the installed React (and
  leaves it unset without one); and that the exported `base` is the parsed
  `oxlintrc.jsonc` except for its `jsPlugins` entries, which are absolute
  paths.
- **`js-plugins.test.js`** — the `jsPlugins` layer, from a packed and
  installed tarball (see [Restored through JS plugins](#restored-through-js-plugins)).
- **`parity.test.js`** — `@jlg/eslint` behaviors the base restores through
  config rather than a rule, linted from the checkout through both entries:
  `env.node`, `no-unused-vars` defaults, `typescript/*` off on JS, the
  eslint-config-prettier offs, `require-await`, `group-exports`, root-only
  tooling configs, override ordering per entry, and the directive-ban throw.

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

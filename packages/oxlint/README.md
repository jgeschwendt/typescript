# @jlg/oxlint

Shareable [oxlint](https://oxc.rs/docs/guide/usage/linter) base config. `defineConfig()` in
`index.js` builds it at call time and returns one flat oxlint config. [The rules
table](https://jgeschwendt.github.io/typescript/) ([snapshot](https://github.com/jgeschwendt/typescript/blob/main/packages/oxlint/__tests__/__snapshots__/rules.test.js.snap)) has one line per rule of
the enabled oxlint plugins and of the retired `@jlg/eslint`'s catalogs: oxlint's category, on or
off in `@jlg/eslint`, native, JS plugin or missing in oxlint, its severity here, and whether the
options match.

## Consumption

oxlint auto-discovers `oxlint.config.ts` (or `.mts`); other extensions load only via `-c`
(verified 2026-10-09 · probe, oxlint 1.87).

```ts
// oxlint.config.ts at your repo root
import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'], // the base sets none
  options: { typeAware: true }, // root-only; see "Type-aware linting"
  overrides: [],
  rules: {},
});
```

| key                    | result                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| `categories`, `rules`  | base, yours merged over                                                     |
| `plugins`, `jsPlugins` | base, plus yours                                                            |
| `overrides`            | base's for the detected environment, then yours (last, so they win)         |
| `settings`             | `react.version` from the `react` your project resolves, then yours          |
| `env`                  | oxlint's own pass through; `next`, `react`, `typescript` override detection |
| anything else          | passes through                                                              |

### Environment detection

Read from `dependencies` and `devDependencies` of the nearest `package.json` at or above the
working directory; none found turns all three on. Force one with `env: { next: true }`. In a
monorepo linted from the root, the root `package.json` decides.

| detected     | overrides added                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| always       | `env.node` on source files; `typescript/*` off on JS files; root tooling configs |
| `typescript` | `**/*.{cts,mts,ts,tsx}`: core twins off, `typescript-js/*`                       |
| `react`      | `**/*.tsx` naming set                                                            |
| `next`       | `route.ts` naming, segment/route-file exemptions                                 |

## Composing

oxlint merge behavior a consumer config works with (verified 2026-10-09/13 · probes, oxlint 1.87):

- Your overrides follow the base's, so a `**/*.tsx` one beats the Next segment-file exemptions;
  scope globs to keep them.
- A base override beats your top-level `rules`; change what one sets with an override.
- Enabling a native plugin, even in an override, puts all its rules under root `categories`;
  overrides take no `categories`, so name unwanted rules off.
- A `./` glob anchors at the root config's directory; a bare one matches at any depth.
- A nested `oxlint.config.ts` replaces the root for its subtree: call `defineConfig` there with
  everything the subtree needs.
- `options` are root-only: a nested one rejects the run; the root's applies in subtrees.
- `extends` takes config objects, not path strings.

## Runtime

| runtime | invoked by                                      | requires                                 |
| ------- | ----------------------------------------------- | ---------------------------------------- |
| Node    | `oxlint`, `bun run`, `bunx` (the bin's shebang) | `^20.19.0 \|\| >=22.18.0` (TS stripping) |
| Bun     | `bun --bun oxlint`: config and every JS plugin  | ≥1.4                                     |

Bun 1.3 cannot resolve the JSON `require` in eslint-plugin-unicorn 77's `@eslint/css-tree` and
rejects the config (verified 2026-10-11 · probe, 1.3.14 fails, 1.4.2 loads).

## Policy

Every category is on at error: `correctness`, `pedantic`, `perf`, `restriction`, `style`,
`suspicious`; `nursery` off. `index.js` then retunes rules, each off with its reason.

A rule an oxlint release adds to an on category activates unnamed and sets no floor under the
`oxlint` peer. That includes the React Compiler rules (oxlint ≥1.80), five of which upstream's
preset ships off and this base keeps on: `no-deriving-state-in-effects`, `capitalized-calls`,
`exhaustive-effect-dependencies`, `hooks`, `memo-dependencies`. Turn one off in `rules`.

## Type-aware linting

Opt in with `options: { typeAware: true }` (the `--type-aware` flag). The base never sets it, since
only the consumer can provide:

- `oxlint-tsgolint` at oxlint's declared peer (`>=7.0.2003` for 1.87)
- TypeScript 7+

An older tsgolint breaks type-aware rules silently ("Failed to find tsgolint executable"), so probe
one after any bump (verified 2026-10-09 · `typescript/no-floating-promises`, 1.87 + 7.0.2003).

Without it, a TS file runs neither version of `no-implied-eval`, `prefer-promise-reject-errors` or
`require-await`: the core rules are off on TS for the type-aware ones. With it, core
`no-throw-literal` and `typescript/only-throw-error` both report a thrown literal.
`typescript/prefer-readonly-parameter-types` is warn: it demands `readonly` on destructured
callback args.

## Restored through JS plugins

`jsPlugins` run ESLint rule code inside oxlint: at import, `index.js` turns on every non-deprecated
rule of the five wrapped plugins that the installed oxlint's `configuration_schema.json` does not
name (the `js` lines of [the rules table](https://jgeschwendt.github.io/typescript/)), except
type-checked ones (`meta.docs.requiresTypeChecking`; `naming-convention` runs untyped) and its
`disabled` map, each entry with its reason; plus the directive ban. On TS files typescript-eslint's
extensions replace their core rule. Retune them like any rule; `oxlint --fix` applies the fixable
ones.

| plugin          | runs                                    |
| --------------- | --------------------------------------- |
| `eslint-js`     | ESLint core rules                       |
| `import-js`     | eslint-plugin-import                    |
| `inline-config` | [the directive ban](#inline-directives) |
| `react-js`      | eslint-plugin-react                     |
| `typescript-js` | typescript-eslint (TS files only)       |
| `unicorn-js`    | eslint-plugin-unicorn                   |

The `-js` suffix avoids oxlint's native `import`, `react` and `unicorn`. How the layer is built:

- Every entry is a local `./plugins/` path that `index.js` absolutizes: a JS config gives oxlint no
  base file to resolve against. The `import-js`, `react-js` and `unicorn-js` wrappers resolve plugin packages from their own real path,
  which an isolated install's consumer config cannot see.
- `plugins/host` wraps each ESLint plugin: a fresh `context`/`sourceCode` per file (oxlint reuses one
  per rule, leaking state across files), ESLint's `getJSDocComment` restored, and a throwing
  listener reported as `Rule crashed under oxlint's JS plugin host: <message>` for that rule alone
  rather than oxlint dropping every JS-plugin report on the file.
- `import-js` hands eslint-module-utils `@typescript-eslint/parser`: oxlint leaves
  `languageOptions.parser.parse` unimplemented.
- typescript-eslint throws on TypeScript 7, so `plugins/typescript6` points its `typescript`
  import at `@typescript/typescript6` (`module.registerHooks` on Node, `Module._resolveFilename`
  on Bun). Everything else stays on 7.
- JS plugins are alpha, outside oxlint's semver, under a `^1.87.0` peer.
- unicorn floats at `^78` on ESLint 10. eslint-plugin-import loads per rule: `no-unused-modules`
  needs ESLint ≤9 internals and is opted out.

## Inline directives

`inline-config/no-directives` makes any directive fail the run (it still suppresses what it names).
It reports every `eslint-*`/`oxlint-*` `disable`, `enable`, `disable-line`, `disable-next-line` and
`eslint-env` comment, block `eslint`/`oxlint` rule config, and `global`, `globals`, `exported`.
oxlint's `options.respectEslintDisableDirectives: false` covers only `eslint-*`.

A directive covering its own comment (a block `disable` that is blanket or names `inline-config/*`,
or a `disable-line`) throws `Error running JS plugin … would suppress its own report`: exit 1,
every JS-plugin report on the file dropped, and `-f unix` prints only an empty `file:0:0:
[Warning]` line. A line `// oxlint-disable` applies after its own line and reports normally
(verified 2026-10-09 · probe, oxlint 1.87).

## Caveats

- An unknown rule or plugin name rejects the whole config (exit 1, nothing lints); a valid rule
  whose plugin is not in `plugins` never runs, silently. Check names with
  `oxlint --rules --format json`; [the tests](#testing) guard the base.
- Set `options.reportUnusedDisableDirectives` in the root config. The bare
  `--report-unused-disable-directives` flag overrides it to warn (exit 0 on an `"error"` config);
  use `--report-unused-disable-directives-severity=error` (verified 2026-10-09 · probe).
- `oxlint --fix` applies one pass; re-run until stable.
- Columns count UTF-8 bytes after non-ASCII text (verified 2026-10-09 · probe).

From oxlint's JS plugin host:

- A file with no `import`/`export` parses as a script: `unicorn-js/no-unused-properties` skips its
  top level, eslint-plugin-react detection can crash, octals pass. Add `export {}`.
- oxc sets `importKind` on JS imports: `unicorn-js/no-keyword-prefix` reports a shorthand
  specifier twice.
- `import-js/no-unresolved` ignores package `exports`, so it flags exports-only packages and `bun:`
  builtins in JS files; relax it with `ignore` in a JS-files override.
- eslint-plugin-react reads `@jsx <word>` in any comment as a pragma.
- JS plugins see `settings` only from the root or the governing nested config; the base sets
  `settings.react.version` from the installed react, or a far-future semver without one.
- JS plugins get no types: `typescript-js/naming-convention` refuses the `types` option.

## Testing

`bun run --filter '@jlg/oxlint' test` runs `bun test` over `__tests__/`:

- `rule-existence.test.js`: every emitted native rule exists in an enabled plugin's
  `oxlint --rules` catalog (the `-js` ones are checked by `js-plugins.test.js`), and no
  category-enabled `typescript/*` rule stays on for JS files.
- `rules.test.js`: snapshots every rule of the enabled plugins and of `@jlg/eslint`'s catalogs
  against this base, one `rule | category | old | oxlint | base | options[: reason]` row each, so a
  rule a bump adds to an error category shows as a diff at review, and fails on a rule that was
  on, is native, and is off here outside its deliberate list.
  `bun run --filter '@jlg/oxlint' report` renders the same `rules.js` rows to a filterable,
  sortable `__tests__/rules.html` styled by `ui.css` beside it (`ui.css` vendored from
  jgeschwendt/ui @ 162e78b): old and base options are each resolved over the rule's declared defaults
  as ESLint does and compared over the keys the rule's ESLint schema knows, so an oxlint-only key
  never counts; `-` where the base runs no such rule, `unverified` for an old key the schema no
  longer has or a bare base with no declared defaults, unless read by hand to `same`; each `differs` and `unverified` carries its
  reason, and a click opens the old and base options side by side;
  regenerate and commit it after every snapshot change. A push to `main` touching either publishes
  both to [GitHub Pages](https://jgeschwendt.github.io/typescript/).
- `define-config.test.js`: the `defineConfig` contract (detection, merge order, `env`, `settings`),
  and a snapshot of every base override; regenerate it as below after an override edit.
- `js-plugins.test.js`: installs the packed tarball beside `typescript@7` and `oxlint` under both
  bun linkers, lints through `oxlint.config.ts` on Node and Bun, and fails on any crashed JS-plugin
  rule or unless every fixtured one reports. Needs the network or a warm bun cache.
- `host.test.js`: `plugins/host` end to end through a probe plugin: a throwing listener reports
  once and stops that rule on the file; the restored `getJSDocComment` attaches as ESLint's does.
- `lint.test.js`: a per-file table of codes that must or must not report, linted end to end through
  a consumer config (`env.node`, `no-unused-vars` options, Next and tooling exemptions, override
  order, TypeScript rules off JS), plus the directive ban and its self-suppression throw.

After an intentional oxlint bump, review the rules snapshot diff, then regenerate:

```sh
bun run --filter '@jlg/oxlint' test --update-snapshots
```

The tests read the catalog of the `oxlint` resolved from `__tests__/`:
`packages/oxlint/node_modules/oxlint` before the hoisted root copy. A root-only bump leaves tests
and a regenerated snapshot on the old catalog with a silent no-diff; bump
`packages/oxlint/package.json`'s `devDependencies.oxlint` too and confirm
`packages/oxlint/node_modules/oxlint/package.json` reports the new version before regenerating.

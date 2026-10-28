# oxlint

```stele
kind: container
purpose: Shareable oxlint base config. index.js is the whole base; defineConfig() adds overrides per detected bun/next/react/typescript, returns one flat config. Maximalist.
commands:
  test: bun run --filter '@jlg/oxlint' test
  snapshot-regen: bun run --filter '@jlg/oxlint' test --update-snapshots
invariants:
  - claim: SINGLE SOURCE OF TRUTH — index.js is the only base ruleset, defineConfig its only config entry and `off` its only other export, the reasoned opt-out map the rules table reads; no JSON copy, no `base` export; consumer overrides always follow the base's; never fork the data
    anchor: ※ oxlint-base
  - claim: SNAPSHOT GATE — the rules.test.js bun snapshot (every rule of the enabled oxlint plugins and of the wrapped ESLint plugins' catalogs, one line each) and the define-config.test.js overrides snapshot (its typescript override derives from the catalogs) are the review gate for oxlint and typescript-eslint bumps; a bump adds new rules to on-categories as consumer-facing errors, so regen and review both diffs
    anchor: ※ rules-gate
  - claim: MAXIMALIST OPT-OUT — every non-deprecated rule of the wrapped ESLint plugins that oxlint lacks runs through the -js plugins at error by default; the only mechanical exclusion is requiresTypeChecking; every other off the base sets at top level, native or -js and runtime floors aside, is a named entry in `off` with a factual one-line reason (crash under the host, duplicate of a native rule, formatting oxfmt owns, non-JS language, contradiction with a rule the base runs, syntax the house writes), and rules.test.js fails on a reasonless off — noise is never a reason, the owner walks every entry
    anchor: ※ opt-out-map
hazards:
  - claim: FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid native rule whose plugin isn't enabled is a SILENT no-op; rule-existence.test.js guards native rules, lint.test.js (oxlint's own config-load check) guards jsPlugins rules, and js-plugins.test.js the Node-floor offs
    anchor: ※ rule-existence-guard
  - claim: VERSION PAIRING — the base depends on oxlint-tsgolint (oxlint 1.89 peers on >=7.0.2003) and points OXLINT_TSGOLINT_PATH at it unless the consumer lists its own; under bun --bun that env never reaches oxlint's binary, so only a hoisted .bin/tsgolint serves (probed 2026-10-27); an old tsgolint breaks type-aware SILENTLY, so probe it per bump
    anchor: ※ oxlint-tsgolint-pairing
  - claim: PEER COUPLING — peerDependencies.oxlint is a caret range though JS plugins are alpha; naming a version-N-only rule in index.js puts a floor of N under any range it widens to (older consumers hard-fail on the unknown name); category-activated rules and the catalog-filtered `typescriptOnly` don't; js-plugins.test.js lints on the range's floor oxlint
    anchor: ※ oxlint-peer-coupling
  - claim: SNAPSHOT RESOLUTION — the guard tests resolve oxlint from packages/oxlint/node_modules first, so a root-only oxlint bump leaves packages/oxlint's devDependency (and the regenerated rules.test.js snapshot) on the OLD catalog with a silent no-diff; bump both package.json files together
    anchor: ※ snapshot-resolution
  - claim: "JS PLUGINS — index.js's jsPlugins run, as ESLint rule code, every live rule of the five wrapped plugins that the installed oxlint's configuration_schema.json does not name, minus typed rules and the reasoned `off` map, plus the directive ban, the printWidth divider and the TS-only Readonly<{…}> rule; every entry is a local plugins/*.js (a bare specifier cannot resolve from an isolated install's symlink) adapted to oxlint's host by host.js, which lists only keys defineConfig recorded (oxlint loads each listed rule after evaluating every config; probed 2026-10-27); JS plugins are alpha and outside oxlint's semver, so js-plugins.test.js gates every bump; a plugin that fails to load rejects the WHOLE config, and one that loads can report nothing (unicorn 66 stubbed two rules); unicorn floats at ^79 on eslint ^10, and eslint-plugin-import's index loads whole on ESLint 10 (probed 2026-10-21), but its no-unused-modules reaches for ESLint 9 internals and stays in `off` — js-plugins.test.js installs the packed tarball under both bun linkers, lints through a consumer oxlint.config.ts on node and bun, and fails on any crashed rule or unless every fixtured rule reports; typescript6.js redirects typescript-eslint's typescript import to @typescript/typescript6"
    anchor: ※ oxlint-js-plugins
  - claim: JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 through the bins' node shebang, plain `bun run`/`bunx` included, but under Bun with `bun --bun` — as do oxlint's JS plugins (probed 2026-10-09); in a JS config oxlint `extends` takes config OBJECTS, not path strings, and a nested config replaces the root for its subtree (options stay root-only, and a nested one fails the run)
    anchor: ※ oxlint-extends-objects
edges:
  depends: [packages/oxfmt]
```

<!-- @stele -->
<!-- @end -->

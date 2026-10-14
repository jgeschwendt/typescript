# oxlint

```stele
kind: container
purpose: Shareable oxlint base config, successor to @jlg/eslint. index.js is the whole base; defineConfig() adds overrides per detected next/react/typescript, returns one flat config. Maximalist.
commands:
  test: bun run --filter '@jlg/oxlint' test
  snapshot-regen: bun run --filter '@jlg/oxlint' test --update-snapshots
invariants:
  - claim: SINGLE SOURCE OF TRUTH — index.js is the only base ruleset and defineConfig its only entry; no JSON copy, no `base` export; consumer overrides always follow the base's; never fork the data
    anchor: ※ oxlint-base
  - claim: SNAPSHOT GATE — the rules.test.js bun snapshot (every rule of the enabled oxlint plugins and of @jlg/eslint's catalogs, one line each) is the review gate for oxlint version bumps; a bump adds new rules to on-categories as consumer-facing errors, so regen and review the diff
    anchor: ※ rules-gate
hazards:
  - claim: FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid rule whose plugin isn't enabled is a SILENT no-op; both guarded by rule-existence.test.js
    anchor: ※ rule-existence-guard
  - claim: VERSION PAIRING — oxlint 1.87 declares peer oxlint-tsgolint >=7.0.2003 (probed 2026-10-09); an old tsgolint breaks type-aware SILENTLY ('Failed to find tsgolint executable') and a TS-free repo still lints green; probe type-aware directly when bumping
    anchor: ※ oxlint-tsgolint-pairing
  - claim: PEER COUPLING — peerDependencies.oxlint is a caret range though JS plugins are alpha; naming a version-N-only rule in index.js puts a floor of N under any range it widens to (older consumers hard-fail on the unknown name); category-activated rules don't
    anchor: ※ oxlint-peer-coupling
  - claim: SNAPSHOT RESOLUTION — the guard tests resolve oxlint from packages/oxlint/node_modules first, so a root-only oxlint bump leaves packages/oxlint's devDependency (and the regenerated rules.test.js snapshot) on the OLD catalog with a silent no-diff; bump both package.json files together
    anchor: packages/oxlint/README.md#testing
  - claim: "JS PLUGINS — index.js's jsPlugins run 40 dropped @jlg/eslint rules as ESLint rule code, plus the inline-directive ban; every entry is a local plugins/*.mjs (a bare specifier cannot resolve from an isolated install's symlink) adapted to oxlint's host by host.mjs; JS plugins are alpha and outside oxlint's semver, so js-plugins.test.js gates every bump; a plugin that fails to load rejects the WHOLE config, and one that loads can report nothing (unicorn 66 stubbed two rules); unicorn floats at ^77 on eslint ^10, and eslint-plugin-import loads per rule because its index needs ESLint 9 internals — js-plugins.test.js installs the packed tarball under both bun linkers, lints through a consumer oxlint.config.ts on node and bun, and fails unless every configured rule reports; typescript6.mjs redirects typescript-eslint's typescript import to @typescript/typescript6"
    anchor: ※ oxlint-js-plugins
  - claim: JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 through the bins' node shebang, plain `bun run`/`bunx` included, but under Bun with `bun --bun` — as do oxlint's JS plugins (probed 2026-10-09); in a JS config oxlint `extends` takes config OBJECTS, not path strings, and a nested config replaces the root for its subtree (options stay root-only, and a nested one fails the run)
    anchor: ※ oxlint-extends-objects
```

<!-- @stele -->
<!-- @end -->

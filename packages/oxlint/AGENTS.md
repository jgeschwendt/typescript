# oxlint

```stele
kind: container
purpose: Shareable oxlint base config (successor to @jlg/eslint). oxlintrc.jsonc is the base ruleset; index.mjs exposes defineConfig/base for JS configs. Maximalist — every category on, then curated overrides.
commands:
  test: bun run --filter '@jlg/oxlint' test
  snapshot-regen: bun run --filter '@jlg/oxlint' test --update-snapshots
invariants:
  - claim: SINGLE SOURCE OF TRUTH — oxlintrc.jsonc is the only base ruleset; index.mjs parses it at import so JS and raw-JSONC consumers never drift; never fork the data
    anchor: ※ oxlint-base
  - claim: SNAPSHOT GATE — the rule-inventory bun snapshot is the review gate for oxlint version bumps; a bump adds new rules to on-categories as consumer-facing errors, so regen and review the diff
    anchor: ※ rule-inventory-gate
hazards:
  - claim: FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid rule whose plugin isn't enabled is a SILENT no-op; both guarded by rule-existence.test.js
    anchor: ※ rule-existence-guard
  - claim: VERSION PAIRING — oxlint 1.82 declares peer oxlint-tsgolint >=7.0.2001 (probed 2026-09-08); an old tsgolint breaks type-aware SILENTLY ('Failed to find tsgolint executable') and a TS-free repo still lints green; probe type-aware directly when bumping
    anchor: ※ oxlint-tsgolint-pairing
  - claim: PEER COUPLING — naming a version-N-only rule in oxlintrc.jsonc forces peerDependencies.oxlint to ^N (older consumers hard-fail on the unknown name); category-activated rules don't
    anchor: ※ oxlint-peer-coupling
  - claim: SNAPSHOT RESOLUTION — the guard tests resolve oxlint from packages/oxlint/node_modules first, so a root-only oxlint bump leaves packages/oxlint's devDependency (and the regenerated snapshot) on the OLD catalog with a silent no-diff; bump both package.json files together
    anchor: packages/oxlint/README.md#testing
  - claim: JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 even when invoked via bun; in a JS config oxlint `extends` takes config OBJECTS, not path strings
    anchor: ※ oxlint-extends-objects
```

<!-- @stele -->
<!-- @end -->

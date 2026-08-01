# typescript

```stele
kind: system
purpose: Bun-workspace monorepo that publishes the @jlg shared toolchain configs — oxlint (lint), oxfmt (format), tsconfig. No app code; the packages ARE the product.
commands:
  lint: bun run lint
  fmt:check: bun run fmt:check
  save: ./save
  publish-check: ./publish --dry-run
invariants:
  - claim: source packages keep @jlg/* names; ./publish stages and rewrites them to @jgeschwendt/* for GitHub Packages (scope must equal repo owner); the npmjs @jlg org is the end state — delete the rewrite then
    anchor: lm:publish-scope-rewrite
hazards:
  - claim: MIRRORED PAIR — every base key in packages/oxfmt/oxfmtrc.json must also appear here in .oxfmtrc.jsonc; oxfmt has no `extends`, so the two files are edited together
    anchor: lm:oxfmt-mirror-root
```

<!-- stele:begin router -->

## Hazards (6 active)

- ⚠ `/`: MIRRORED PAIR — every base key in packages/oxfmt/oxfmtrc.json must also appear here in .oxfmtrc.jsonc; oxfmt has no `extends`, so the two files are edited together (→ lm:oxfmt-mirror-root)
- ⚠ `packages/oxlint`: JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 even when invoked via bun; in a JS config oxlint `extends` takes config OBJECTS, not path strings (→ lm:oxlint-extends-objects)
- ⚠ `packages/oxlint`: PEER COUPLING — naming a version-N-only rule in oxlintrc.jsonc forces peerDependencies.oxlint to ^N (older consumers hard-fail on the unknown name); category-activated rules don't (→ lm:oxlint-peer-coupling)
- ⚠ `packages/oxlint`: VERSION PAIRING — oxlint 1.75 requires oxlint-tsgolint >=7.0.2001; an old tsgolint breaks type-aware SILENTLY ('Failed to find tsgolint executable') and a TS-free repo still lints green; probe type-aware directly when bumping (→ lm:oxlint-tsgolint-pairing)
- ⚠ `packages/oxfmt`: MIRRORED PAIR — every key in this oxfmtrc.json must also appear in the repo-root .oxfmtrc.jsonc; oxfmt has no `extends`, so the base cannot compose by reference and the two are edited together (→ packages/oxfmt/README.md#relationship-to-the-repo-root)
- ⚠ `packages/oxlint`: FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid rule whose plugin isn't enabled is a SILENT no-op; both guarded by rule-existence.test.js (→ lm:rule-existence-guard)

## Map

| node     | kind      | purpose                                                                                                                                                                                           | unfold                                                 |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| packages | container | The three shipped configs. oxlint and oxfmt each carry a base ruleset plus the guard tests that keep it honest; tsconfig is a single shared tsconfig.json. Per-package detail lives in each node. | `stele unfold packages` · or read `packages/AGENTS.md` |

## Indexes

All invariants: `.stele/index/invariants.md` · all hazards: `.stele/index/hazards.md`

## Engine

`stele` CLI available → `stele root | unfold <id> | invariants --touching <path> | hazards | nodes --kind <k>`. MCP: `stele serve`.
No engine → everything above is complete; nested AGENTS.md files carry the detail (nearest file wins).
<!-- stele:end -->

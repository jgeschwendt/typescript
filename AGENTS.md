# typescript

```stele
kind: system
purpose: Bun-workspace monorepo that publishes the @jlg toolchain configs to npm — oxlint (lint), oxfmt (format), tsconfig. No app code; the packages ARE the product. Releases are changesets-driven.
commands:
  changeset: bun run changeset
  fmt:check: bun run fmt:check
  lint: bun run lint
  test: bun test
invariants:
  - claim: MINIMUM BUMP — pre-1.0 every changeset is patch, or minor for a breaking change; major is forbidden until a deliberate 1.0, and the ci check job fails on one
    anchor: ※ changeset-guard
  - claim: RELEASE APPROVAL — a patch-only Version Packages PR auto-merges; any minor (or post-1.0 major) bump skips auto-merge and requests the owner's review, and the hand merge is the approval
    anchor: ※ release-approval-gate
hazards:
  - claim: "VERSION PR TOKEN — the Version Packages PR must be opened with the release app token, never GITHUB_TOKEN: GITHUB_TOKEN-created events trigger no workflows, so the required check never runs and the PR can never merge"
    anchor: ※ release-app-token
  - claim: "ROOT NAME — the workspace root is named typescript-monorepo, never typescript: changesets treats a workspace named like a dependency (@jlg/tsconfig peers on typescript) as satisfying it, reads its missing version, and every changeset command crashes with ERR_INVALID_ARG_TYPE"
    anchor: README.md#releasing
  - claim: MIRRORED PAIR — every base key in packages/oxfmt/oxfmtrc.json must also appear here in .oxfmtrc.jsonc; oxfmt has no `extends`, so the two files are edited together
    anchor: ※ oxfmt-mirror-root
```

<!-- @stele -->

## Hazards (9 active)

- ⚠ `/`: MIRRORED PAIR — every base key in packages/oxfmt/oxfmtrc.json must also appear here in .oxfmtrc.jsonc; oxfmt has no `extends`, so the two files are edited together (→ ※ oxfmt-mirror-root)
- ⚠ `packages/oxlint`: JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 even when invoked via bun; in a JS config oxlint `extends` takes config OBJECTS, not path strings (→ ※ oxlint-extends-objects)
- ⚠ `packages/oxlint`: PEER COUPLING — naming a version-N-only rule in oxlintrc.jsonc forces peerDependencies.oxlint to ^N (older consumers hard-fail on the unknown name); category-activated rules don't (→ ※ oxlint-peer-coupling)
- ⚠ `packages/oxlint`: VERSION PAIRING — oxlint 1.82 declares peer oxlint-tsgolint >=7.0.2001 (probed 2026-09-08); an old tsgolint breaks type-aware SILENTLY ('Failed to find tsgolint executable') and a TS-free repo still lints green; probe type-aware directly when bumping (→ ※ oxlint-tsgolint-pairing)
- ⚠ `packages/oxfmt`: MIRRORED PAIR — every key in this oxfmtrc.json must also appear in the repo-root .oxfmtrc.jsonc; oxfmt has no `extends`, so the base cannot compose by reference and the two are edited together (→ packages/oxfmt/README.md#relationship-to-the-repo-root)
- ⚠ `/`: VERSION PR TOKEN — the Version Packages PR must be opened with the release app token, never GITHUB_TOKEN: GITHUB_TOKEN-created events trigger no workflows, so the required check never runs and the PR can never merge (→ ※ release-app-token)
- ⚠ `/`: ROOT NAME — the workspace root is named typescript-monorepo, never typescript: changesets treats a workspace named like a dependency (@jlg/tsconfig peers on typescript) as satisfying it, reads its missing version, and every changeset command crashes with ERR_INVALID_ARG_TYPE (→ README.md#releasing)
- ⚠ `packages/oxlint`: FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid rule whose plugin isn't enabled is a SILENT no-op; both guarded by rule-existence.test.js (→ ※ rule-existence-guard)
- ⚠ `packages/oxlint`: SNAPSHOT RESOLUTION — the guard tests resolve oxlint from packages/oxlint/node_modules first, so a root-only oxlint bump leaves packages/oxlint's devDependency (and the regenerated snapshot) on the OLD catalog with a silent no-diff; bump both package.json files together (→ packages/oxlint/README.md#testing)

## Map

| node     | kind      | purpose                                                                                                                                                                                           | unfold                                                 |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| packages | container | The three shipped configs. oxlint and oxfmt each carry a base ruleset plus the guard tests that keep it honest; tsconfig is a single shared tsconfig.json. Per-package detail lives in each node. | `stele unfold packages` · or read `packages/AGENTS.md` |

## Indexes

All invariants: `.stele/index/invariants.md` · all hazards: `.stele/index/hazards.md`

## Engine

`stele` CLI available → `stele root | unfold <id> | invariants --touching <path> | hazards | nodes --kind <k>`. MCP: `stele serve`.
No engine → everything above is complete; nested AGENTS.md files carry the detail (nearest file wins).
<!-- @end -->

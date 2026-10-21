# typescript

```stele
kind: system
purpose: Bun-workspace monorepo that publishes the @jlg toolchain configs to npm — oxlint (lint), oxfmt (format), tsconfig. No app code; the packages ARE the product. Releases are changesets-driven.
commands:
  changeset: bun run changeset
  format-check: bunx oxfmt --check
  lint: bunx oxlint
  test: bun test
invariants:
  - claim: MINIMUM BUMP — pre-1.0 every changeset is patch, or minor for a breaking change; major is forbidden until a deliberate 1.0, and the ci check job fails on one
    anchor: ※ changeset-guard
  - claim: RELEASE APPROVAL — a patch-only Version Packages PR auto-merges; any minor (or post-1.0 major) bump skips auto-merge, and ci's required check fails on that PR until the owner applies the release:signed-off label — the label is the sign-off, and agents never apply it
    anchor: ※ release-approval-gate
hazards:
  - claim: "VERSION PR TOKEN — the Version Packages PR must be opened with the release app token, never GITHUB_TOKEN: GITHUB_TOKEN-created events trigger no workflows, so the required check never runs and the PR can never merge"
    anchor: ※ release-app-token
  - claim: "ROOT NAME — the workspace root is named jlg, never typescript: changesets treats a workspace named like a dependency (@jlg/tsconfig peers on typescript) as satisfying it, reads its missing version, and every changeset command crashes with ERR_INVALID_ARG_TYPE"
    anchor: ※ root-name
edges:
  depends: [packages/oxfmt, packages/oxlint]
```

<!-- @stele -->

## Hazards (8 active)

- ⚠ `packages/oxlint`: JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 through the bins' node shebang, plain `bun run`/`bunx` included, but under Bun with `bun --bun` — as do oxlint's JS plugins (probed 2026-10-09); in a JS config oxlint `extends` takes config OBJECTS, not path strings, and a nested config replaces the root for its subtree (options stay root-only, and a nested one fails the run) (→ ※ oxlint-extends-objects)
- ⚠ `packages/oxlint`: JS PLUGINS — index.js's jsPlugins run, as ESLint rule code, every live rule of the five wrapped plugins that the installed oxlint's configuration_schema.json does not name, minus typed rules and the reasoned `disabled` opt-out map, plus the inline-directive ban; every entry is a local plugins/*.js (a bare specifier cannot resolve from an isolated install's symlink) adapted to oxlint's host by host.js; JS plugins are alpha and outside oxlint's semver, so js-plugins.test.js gates every bump; a plugin that fails to load rejects the WHOLE config, and one that loads can report nothing (unicorn 66 stubbed two rules); unicorn floats at ^78 on eslint ^10, and eslint-plugin-import loads per rule because its index needs ESLint 9 internals — js-plugins.test.js installs the packed tarball under both bun linkers, lints through a consumer oxlint.config.ts on node and bun, and fails on any crashed rule or unless every fixtured rule reports; typescript6.js redirects typescript-eslint's typescript import to @typescript/typescript6 (→ ※ oxlint-js-plugins)
- ⚠ `packages/oxlint`: PEER COUPLING — peerDependencies.oxlint is a caret range though JS plugins are alpha; naming a version-N-only rule in index.js puts a floor of N under any range it widens to (older consumers hard-fail on the unknown name); category-activated rules don't (→ ※ oxlint-peer-coupling)
- ⚠ `packages/oxlint`: VERSION PAIRING — oxlint 1.87 declares peer oxlint-tsgolint >=7.0.2003 (probed 2026-10-09); an old tsgolint breaks type-aware SILENTLY ('Failed to find tsgolint executable') and a TS-free repo still lints green; probe type-aware directly when bumping (→ ※ oxlint-tsgolint-pairing)
- ⚠ `/`: VERSION PR TOKEN — the Version Packages PR must be opened with the release app token, never GITHUB_TOKEN: GITHUB_TOKEN-created events trigger no workflows, so the required check never runs and the PR can never merge (→ ※ release-app-token)
- ⚠ `/`: ROOT NAME — the workspace root is named jlg, never typescript: changesets treats a workspace named like a dependency (@jlg/tsconfig peers on typescript) as satisfying it, reads its missing version, and every changeset command crashes with ERR_INVALID_ARG_TYPE (→ ※ root-name)
- ⚠ `packages/oxlint`: FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid rule whose plugin isn't enabled is a SILENT no-op; both guarded by rule-existence.test.js (→ ※ rule-existence-guard)
- ⚠ `packages/oxlint`: SNAPSHOT RESOLUTION — the guard tests resolve oxlint from packages/oxlint/node_modules first, so a root-only oxlint bump leaves packages/oxlint's devDependency (and the regenerated rules.test.js snapshot) on the OLD catalog with a silent no-diff; bump both package.json files together (→ ※ snapshot-resolution)

## Map

| node            | kind      | purpose                                                                                                                                                                                           | unfold                                                               |
| --------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| packages        | container | The three shipped configs. oxlint and oxfmt each carry a base ruleset plus the guard tests that keep it honest; tsconfig is a single shared tsconfig.json. Per-package detail lives in each node. | `stele unfold packages` · or read `packages/AGENTS.md`               |
| packages/oxfmt  | container | Canonical oxfmt settings — formatter companion to @jlg/oxlint. oxfmtrc.json holds the opinions; index.js merges it in (oxfmt has no `extends`). Repo-local keys stay in the consumer.             | `stele unfold packages/oxfmt` · or read `packages/oxfmt/AGENTS.md`   |
| packages/oxlint | container | Shareable oxlint base config. index.js is the whole base; defineConfig() adds overrides per detected bun/next/react/typescript, returns one flat config. Maximalist.                              | `stele unfold packages/oxlint` · or read `packages/oxlint/AGENTS.md` |

## Indexes

All invariants: `.stele/index/invariants.md` · all hazards: `.stele/index/hazards.md`

## Engine

`stele` CLI available → `stele root | unfold <id> | invariants --touching <path> | hazards | nodes --kind <k>`. MCP: `stele serve`.
No engine → everything above is complete; nested AGENTS.md files carry the detail (nearest file wins).
<!-- @end -->

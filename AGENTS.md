# typescript

```stele
kind: system
purpose: Bun-workspace monorepo publishing to npm — the @jlg configs (oxlint, oxfmt, tsconfig), the private hud layer and the verax library. The packages ARE the product; changesets drive releases.
commands:
  changeset: bun run changeset
  format-check: bunx oxfmt --check
  lint: bunx oxlint
  test: bun test
invariants:
  - claim: MINIMUM BUMP — pre-1.0 every changeset is patch, or minor for a breaking change; major is forbidden until a deliberate 1.0, and the ci check job fails on one; the guard regexes name every unscoped package (verax) beside @jlg/*
    anchor: ※ changeset-guard
  - claim: RELEASE APPROVAL — a patch-only Version Packages PR auto-merges; any minor (or post-1.0 major) bump, and every verax bump, skips auto-merge, and ci's required check fails on that PR until the owner applies the release:signed-off label — the label is the sign-off, and agents never apply it
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

## Hazards (11 active)

- ⚠ `packages/oxlint`: JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 through the bins' node shebang, plain `bun run`/`bunx` included, but under Bun with `bun --bun` — as do oxlint's JS plugins (probed 2026-10-09); in a JS config oxlint `extends` takes config OBJECTS, not path strings, and a nested config replaces the root for its subtree (options stay root-only, and a nested one fails the run) (→ ※ oxlint-extends-objects)
- ⚠ `packages/oxlint`: JS PLUGINS — index.js's jsPlugins run, as ESLint rule code, every live rule of the five wrapped plugins that the installed oxlint's configuration_schema.json does not name, minus typed rules and the reasoned `off` map, plus the inline-directive ban and the 100-column section divider; every entry is a local plugins/*.js (a bare specifier cannot resolve from an isolated install's symlink) adapted to oxlint's host by host.js; JS plugins are alpha and outside oxlint's semver, so js-plugins.test.js gates every bump; a plugin that fails to load rejects the WHOLE config, and one that loads can report nothing (unicorn 66 stubbed two rules); unicorn floats at ^79 on eslint ^10, and eslint-plugin-import's index loads whole on ESLint 10 (probed 2026-10-21), but its no-unused-modules reaches for ESLint 9 internals and stays in `off` — js-plugins.test.js installs the packed tarball under both bun linkers, lints through a consumer oxlint.config.ts on node and bun, and fails on any crashed rule or unless every fixtured rule reports; typescript6.js redirects typescript-eslint's typescript import to @typescript/typescript6 (→ ※ oxlint-js-plugins)
- ⚠ `packages/oxlint`: PEER COUPLING — peerDependencies.oxlint is a caret range though JS plugins are alpha; naming a version-N-only rule in index.js puts a floor of N under any range it widens to (older consumers hard-fail on the unknown name); category-activated rules don't, and `typescriptOnly` is filtered through the installed catalog; js-plugins.test.js's packed consumer installs the range's floor oxlint (and that oxlint's tsgolint peer floor), so a name only a newer oxlint knows fails the suite (→ ※ oxlint-peer-coupling)
- ⚠ `packages/oxlint`: VERSION PAIRING — oxlint 1.89 declares peer oxlint-tsgolint >=7.0.2003 (probed 2026-10-20); an old tsgolint breaks type-aware SILENTLY ('Failed to find tsgolint executable') and a TS-free repo still lints green; probe type-aware directly when bumping (→ ※ oxlint-tsgolint-pairing)
- ⚠ `/`: VERSION PR TOKEN — the Version Packages PR must be opened with the release app token, never GITHUB_TOKEN: GITHUB_TOKEN-created events trigger no workflows, so the required check never runs and the PR can never merge (→ ※ release-app-token)
- ⚠ `/`: ROOT NAME — the workspace root is named jlg, never typescript: changesets treats a workspace named like a dependency (@jlg/tsconfig peers on typescript) as satisfying it, reads its missing version, and every changeset command crashes with ERR_INVALID_ARG_TYPE (→ ※ root-name)
- ⚠ `packages/oxlint`: FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid native rule whose plugin isn't enabled is a SILENT no-op; rule-existence.test.js guards native rules, lint.test.js (oxlint's own config-load check) guards jsPlugins rules, and js-plugins.test.js the Node-floor offs (→ ※ rule-existence-guard)
- ⚠ `packages/oxlint`: SNAPSHOT RESOLUTION — the guard tests resolve oxlint from packages/oxlint/node_modules first, so a root-only oxlint bump leaves packages/oxlint's devDependency (and the regenerated rules.test.js snapshot) on the OLD catalog with a silent no-diff; bump both package.json files together (→ ※ snapshot-resolution)
- ⚠ `packages/verax`: DEF IDENTITY — refine and coerce must reuse the inner schema's def object; sdl() detects name collisions and dedupes union members by def identity, so a fresh def breaks sdl naming (→ ※ verax-def-identity)
- ⚠ `packages/verax`: HOT PATH — per-run code never calls Object.entries/Object.keys or iterator helpers (values().every etc.), and `is` runs check-only paths that allocate nothing (outside refine) while parse/validate allocate only the output snapshot; shapes resolve once into plans. Measured on bun 1.4.2 / node 24: iterator helpers 2–11× slower, Object.entries 24–95 ns per call; every perf change is kept only with a before/after run of the benchmark harness (→ ※ verax-hot-path)
- ⚠ `packages/verax`: TYPE TESTS — the `true satisfies Equal<…>` assertions fail only under tsc; bun test strips types, so ci.yaml and the hk pre-push gate (hk.pkl) run `bunx tsc --noEmit` in packages/verax (the lockfile compiler) separately (→ ※ verax-type-tests)

## Map

| node            | kind      | purpose                                                                                                                                                                                                  | unfold                                                               |
| --------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| packages        | container | Three shipped configs, the verax runtime-type library and the private hud layer. oxlint and oxfmt carry a base ruleset and its guard tests; tsconfig is one shared file; hud is a browser comment layer. | `stele unfold packages` · or read `packages/AGENTS.md`               |
| packages/oxfmt  | container | Canonical oxfmt settings — formatter companion to @jlg/oxlint. oxfmtrc.json holds the opinions; index.js merges it in (oxfmt has no `extends`). Repo-local keys stay in the consumer.                    | `stele unfold packages/oxfmt` · or read `packages/oxfmt/AGENTS.md`   |
| packages/oxlint | container | Shareable oxlint base config. index.js is the whole base; defineConfig() adds overrides per detected bun/next/react/typescript, returns one flat config. Maximalist.                                     | `stele unfold packages/oxlint` · or read `packages/oxlint/AGENTS.md` |

## Indexes

All invariants: `.stele/index/invariants.md` · all hazards: `.stele/index/hazards.md`

## Engine

`stele` CLI available → `stele root | unfold <id> | invariants --touching <path> | hazards | nodes --kind <k>`. MCP: `stele serve`.
No engine → everything above is complete; nested AGENTS.md files carry the detail (nearest file wins).
<!-- @end -->

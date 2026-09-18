# Hazards

| claim | node | anchor |
| --- | --- | --- |
| MIRRORED PAIR — every base key in packages/oxfmt/oxfmtrc.json must also appear here in .oxfmtrc.jsonc; oxfmt has no `extends`, so the two files are edited together | / | ※ oxfmt-mirror-root |
| VERSION PR TOKEN — the Version Packages PR must be opened with the release app token, never GITHUB_TOKEN: GITHUB_TOKEN-created events trigger no workflows, so the required check never runs and the PR can never merge | / | ※ release-app-token |
| ROOT NAME — the workspace root is named typescript-monorepo, never typescript: changesets treats a workspace named like a dependency (@jlg/tsconfig peers on typescript) as satisfying it, reads its missing version, and every changeset command crashes with ERR_INVALID_ARG_TYPE | / | README.md#releasing |
| MIRRORED PAIR — every key in this oxfmtrc.json must also appear in the repo-root .oxfmtrc.jsonc; oxfmt has no `extends`, so the base cannot compose by reference and the two are edited together | packages/oxfmt | packages/oxfmt/README.md#relationship-to-the-repo-root |
| JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 even when invoked via bun; in a JS config oxlint `extends` takes config OBJECTS, not path strings | packages/oxlint | ※ oxlint-extends-objects |
| PEER COUPLING — naming a version-N-only rule in oxlintrc.jsonc forces peerDependencies.oxlint to ^N (older consumers hard-fail on the unknown name); category-activated rules don't | packages/oxlint | ※ oxlint-peer-coupling |
| VERSION PAIRING — oxlint 1.82 declares peer oxlint-tsgolint >=7.0.2001 (probed 2026-09-08); an old tsgolint breaks type-aware SILENTLY ('Failed to find tsgolint executable') and a TS-free repo still lints green; probe type-aware directly when bumping | packages/oxlint | ※ oxlint-tsgolint-pairing |
| FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid rule whose plugin isn't enabled is a SILENT no-op; both guarded by rule-existence.test.js | packages/oxlint | ※ rule-existence-guard |
| SNAPSHOT RESOLUTION — the guard tests resolve oxlint from packages/oxlint/node_modules first, so a root-only oxlint bump leaves packages/oxlint's devDependency (and the regenerated snapshot) on the OLD catalog with a silent no-diff; bump both package.json files together | packages/oxlint | packages/oxlint/README.md#testing |

# Hazards

| claim | node | anchor |
| --- | --- | --- |
| MIRRORED PAIR — every base key in packages/oxfmt/oxfmtrc.json must also appear here in .oxfmtrc.jsonc; oxfmt has no `extends`, so the two files are edited together | / | lm:oxfmt-mirror-root |
| MIRRORED PAIR — every key in this oxfmtrc.json must also appear in the repo-root .oxfmtrc.jsonc; oxfmt has no `extends`, so the base cannot compose by reference and the two are edited together | packages/oxfmt | packages/oxfmt/README.md#relationship-to-the-repo-root |
| JS-CONFIG RUNTIME — oxlint/oxfmt .config.ts files evaluate under Node >=22.18 even when invoked via bun; in a JS config oxlint `extends` takes config OBJECTS, not path strings | packages/oxlint | lm:oxlint-extends-objects |
| PEER COUPLING — naming a version-N-only rule in oxlintrc.jsonc forces peerDependencies.oxlint to ^N (older consumers hard-fail on the unknown name); category-activated rules don't | packages/oxlint | lm:oxlint-peer-coupling |
| VERSION PAIRING — oxlint 1.75 requires oxlint-tsgolint >=7.0.2001; an old tsgolint breaks type-aware SILENTLY ('Failed to find tsgolint executable') and a TS-free repo still lints green; probe type-aware directly when bumping | packages/oxlint | lm:oxlint-tsgolint-pairing |
| FOOTGUN — an unknown rule NAME hard-fails the whole oxlint config (exit 1, nothing lints); a valid rule whose plugin isn't enabled is a SILENT no-op; both guarded by rule-existence.test.js | packages/oxlint | lm:rule-existence-guard |

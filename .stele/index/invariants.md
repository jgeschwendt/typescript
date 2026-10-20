# Invariants

| claim | node | anchor |
| --- | --- | --- |
| MINIMUM BUMP — pre-1.0 every changeset is patch, or minor for a breaking change; major is forbidden until a deliberate 1.0, and the ci check job fails on one | / | ※ changeset-guard |
| RELEASE APPROVAL — a patch-only Version Packages PR auto-merges; any minor (or post-1.0 major) bump skips auto-merge, and ci's required check fails on that PR until the owner applies the release:signed-off label — the label is the sign-off, and agents never apply it | / | ※ release-approval-gate |
| MAXIMALIST OPT-OUT — every non-deprecated rule of the wrapped ESLint plugins that oxlint lacks runs through the -js plugins at error by default; the only mechanical exclusion is requiresTypeChecking; every other off is a named entry in `disabled` with a factual one-line reason (crash under the host, duplicate of a native rule, formatting oxfmt owns, non-JS language) — noise is never a reason, the owner walks every entry | packages/oxlint | ※ opt-out-map |
| SINGLE SOURCE OF TRUTH — index.js is the only base ruleset and defineConfig its only entry; no JSON copy, no `base` export; consumer overrides always follow the base's; never fork the data | packages/oxlint | ※ oxlint-base |
| SNAPSHOT GATE — the rules.test.js bun snapshot (every rule of the enabled oxlint plugins and of @jlg/eslint's catalogs, one line each) and the define-config.test.js overrides snapshot (its typescript override derives from the catalogs) are the review gate for oxlint and typescript-eslint bumps; a bump adds new rules to on-categories as consumer-facing errors, so regen and review both diffs | packages/oxlint | ※ rules-gate |

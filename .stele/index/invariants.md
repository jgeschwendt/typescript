# Invariants

| claim | node | anchor |
| --- | --- | --- |
| MINIMUM BUMP — pre-1.0 every changeset is patch, or minor for a breaking change; major is forbidden until a deliberate 1.0, and the ci check job fails on one | / | ※ changeset-guard |
| RELEASE APPROVAL — a patch-only Version Packages PR auto-merges; any minor (or post-1.0 major) bump skips auto-merge and requests the owner's review, and the hand merge is the approval | / | ※ release-approval-gate |
| SINGLE SOURCE OF TRUTH — oxlintrc.jsonc is the only base ruleset; index.mjs parses it at import so JS and raw-JSONC consumers never drift; never fork the data | packages/oxlint | ※ oxlint-base |
| SNAPSHOT GATE — the rule-inventory bun snapshot is the review gate for oxlint version bumps; a bump adds new rules to on-categories as consumer-facing errors, so regen and review the diff | packages/oxlint | ※ rule-inventory-gate |

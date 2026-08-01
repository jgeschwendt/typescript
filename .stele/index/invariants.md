# Invariants

| claim | node | anchor |
| --- | --- | --- |
| source packages keep @jlg/* names; ./publish stages and rewrites them to @jgeschwendt/* for GitHub Packages (scope must equal repo owner); the npmjs @jlg org is the end state — delete the rewrite then | / | lm:publish-scope-rewrite |
| SINGLE SOURCE OF TRUTH — oxlintrc.jsonc is the only base ruleset; index.mjs parses it at import so JS and raw-JSONC consumers never drift; never fork the data | packages/oxlint | lm:oxlint-base |
| SNAPSHOT GATE — the rule-inventory bun snapshot is the review gate for oxlint version bumps; a bump adds new rules to on-categories as consumer-facing errors, so regen and review the diff | packages/oxlint | lm:rule-inventory-gate |

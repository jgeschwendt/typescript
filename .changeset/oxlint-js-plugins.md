---
'@jlg/oxlint': minor
---

Restore 36 rules the eslint→oxlint migration dropped, as the original ESLint rule code through oxlint's `jsPlugins`: `import-js/*` (incl. `order`), `react-js/*`, `unicorn-js/*`, `eslint-js/*` (core rules) and `typescript-js/{member-ordering,naming-convention}`. New lint errors for consumers; `oxlint` is now pinned exactly (1.87.0) because JS plugins are outside its semver. See README "Restored through JS plugins" and GAPS.md.

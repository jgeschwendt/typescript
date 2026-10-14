---
'@jlg/oxlint': patch
---

Every non-deprecated rule of the wrapped plugins that oxlint lacks now runs through the JS plugins unless opted out: `index.js` derives the set at import from the installed oxlint's `configuration_schema.json`, skips type-checked rules (`naming-convention` still runs untyped) and the reasoned `disabled` map (41 entries: crashes, duplicates of native rules, formatting oxfmt owns, non-JS languages, no-ops). 285 rules now run, up from 40: 12 `eslint-js`, 10 `import-js`, 27 `react-js`, 3 `typescript-js` (TS files only, where `eslint-js/consistent-return`, `dot-notation` and `no-invalid-this` give way to typescript-eslint's extensions) and 233 `unicorn-js`, plus `inline-config`. Root tooling configs may default-export their `defineConfig(…)` call (`unicorn-js/no-top-level-side-effects` off there). Each plugin wrapper now registers its whole catalog, so any opted-out rule can be turned on by name.

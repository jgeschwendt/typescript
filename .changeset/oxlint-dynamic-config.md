---
'@jlg/lint': minor
---

Renamed from `@jlg/oxlint` to `@jlg/lint`. The base is now `index.js`: `defineConfig()` builds it in JavaScript and returns one flat config, with no `extends`. Breaking: the published `oxlintrc.jsonc` (the JSON `extends` path) and the `base` export are gone — consume it from an `oxlint.config.ts`. The TypeScript, React (`**/*.tsx`) and Next overrides now apply only when `typescript`, `react` or `next` is in the nearest `package.json`'s dependencies or devDependencies (all three when no `package.json` is found); force them with `defineConfig({ env: { next: true } })`. Consumer overrides now come after every base override, so a consumer `**/*.tsx` override beats the Next segment-file exemptions — the reverse of before. A nested config (`.oxlintrc.json` or `oxlint.config.ts`) replaces the root for its subtree rather than merging, so a nested `oxlint.config.ts` must call `defineConfig` itself and carry everything it needs (`options` stay root-only).

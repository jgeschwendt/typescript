---
'@jlg/oxlint': patch
'@jlg/tsconfig': patch
---

`@jlg/oxlint`: eleven JS-runtime rules a native rule already covers are off, and four native rules that double-reported with a successor or twin are off; guard tests catch the next rename or cross-scope twin.

`@jlg/tsconfig`: `lib` is `DOM` + `ES2025`, and the keys TypeScript 7 defaults (`strict`, `moduleDetection: force`, `moduleResolution`, `forceConsistentCasingInFileNames`, `newLine`, `noUncheckedSideEffectImports`, `resolveJsonModule`, `useDefineForClassFields`) are gone.

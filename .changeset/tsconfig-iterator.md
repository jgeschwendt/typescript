---
'@jlg/tsconfig': patch
---

`lib` gains `ESNext.Iterator`, so iterator helpers (`map`, `filter`, `take`, `toArray`) type-check on Node 22 and 24.

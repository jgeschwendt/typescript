# @jlg/tsconfig

## 0.1.3

### Patch Changes

- [#108](https://github.com/jgeschwendt/typescript/pull/108) [`59ff267`](https://github.com/jgeschwendt/typescript/commit/59ff2670f7a20cf0a25f80ee2314e7f81a46d762) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - `@jlg/oxlint`: eleven JS-runtime rules a native rule already covers are off, and four native rules that double-reported with a successor or twin are off; guard tests catch the next rename or cross-scope twin.

  `@jlg/tsconfig`: `lib` is `DOM` + `ES2025`, and the keys TypeScript 7 defaults (`strict`, `moduleDetection: force`, `moduleResolution`, `forceConsistentCasingInFileNames`, `newLine`, `noUncheckedSideEffectImports`, `resolveJsonModule`, `useDefineForClassFields`) are gone.

## 0.1.2

### Patch Changes

- [#96](https://github.com/jgeschwendt/typescript/pull/96) [`ccf323a`](https://github.com/jgeschwendt/typescript/commit/ccf323a8410e511d713928e52fe70a6ba36cdefa) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - `lib` gains `ESNext.Iterator`, so iterator helpers (`map`, `filter`, `take`, `toArray`) type-check on Node 22 and 24.

## 0.1.1

### Patch Changes

- [#4](https://github.com/jgeschwendt/typescript/pull/4) [`8ad6595`](https://github.com/jgeschwendt/typescript/commit/8ad6595049452a5055859ce10dc171c6a590619a) Thanks [@jgeschwendt](https://github.com/jgeschwendt)! - Ship a README so the npm page explains what the package is and how to extend it.

# @jlg/oxfmt

The canonical [oxfmt](https://oxc.rs/docs/guide/usage/formatter) settings for
`@jlg`

## Usage

```ts
// oxfmt.config.ts
import { defineConfig } from '@jlg/oxfmt';

export default defineConfig({
  // keys layer over the base; oxfmt has no `extends`—this is a merge
  ignorePatterns: ['dist/**'],
  sortTailwindcss: true,
});
```

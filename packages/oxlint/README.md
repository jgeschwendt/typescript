# @jlg/oxlint

The canonical [oxlint](https://oxc.rs/docs/guide/usage/linter) settings for `@jlg`—Maxamalist Opt-out

## Usage

```ts
// oxlint.config.ts; oxlint discovers only .config.ts and .config.mts
import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  // bun, next, react and typescript are read from the nearest package.json; name one to force it
  env: { react: true },
  ignorePatterns: ['**/*.d.ts'],
  // root-only: a nested config naming options fails the run; type-aware needs oxlint-tsgolint
  options: { reportUnusedDisableDirectives: 'error', typeAware: true },
  // the base's overrides come first, so yours win, and an override beats top-level rules
  overrides: [],
  // merged over the base's; a nested oxlint.config.ts replaces the root for its subtree
  rules: {},
});
```

Runs under Node ≥22.18 or Bun ≥1.4 (`bun --bun oxlint`), the JS plugins included.

`engines.node` in the nearest package.json that declares one is the runtime floor: rules naming a
newer API turn off below it; `engines.bun` or `env: { bun: true }` keeps them all.

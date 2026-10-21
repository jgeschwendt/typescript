# @jlg/oxlint

The canonical [oxlint](https://oxc.rs/docs/guide/usage/linter) settings for `@jlg`—Maxamalist Opt-out

## Usage

```ts
// oxlint.config.ts; oxlint discovers only .config.ts and .config.mts
import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  // the base's overrides come first, so yours win, and an override beats top-level rules
  overrides: [],
  // merged over the base's; a nested oxlint.config.ts replaces the root for its subtree
  rules: {},
});
```

`options` are set for the root config: unused directives are errors, type-aware when `typescript`
and `oxlint-tsgolint` are installed; a nested `oxlint.config.ts` gets none (oxlint allows them at
the root only).

Runs under Node ≥22.18 or Bun ≥1.4 (`bun --bun oxlint`), the JS plugins included.

`engines.node` in the nearest package.json that declares one is the runtime floor: rules naming a
newer API turn off below it; `engines.bun` or `env: { bun: true }` keeps them all.

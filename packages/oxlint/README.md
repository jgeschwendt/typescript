# @jlg/oxlint

The canonical [oxlint](https://oxc.rs/docs/guide/usage/linter) settings for `@jlg`—maximalist opt-out

## Usage

```ts
// oxlint.config.{mts,ts};
import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  // set at the root by the base: unused directives error, type-aware once oxlint-tsgolint is installed
  options: { reportUnusedDisableDirectives: 'off', typeAware: true },
  // the base's overrides come first, so yours win, and an override beats top-level rules
  overrides: [],
  // merged over the base's; a nested oxlint.config.ts replaces the root for its subtree
  rules: {},
});
```

> Runs under Node ≥24 or Bun ≥1.4 (`bun --bun oxlint`)—JS plugins included.

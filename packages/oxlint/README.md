# @jlg/oxlint

The canonical [oxlint](https://oxc.rs/docs/guide/usage/linter) settings for `@jlg`—maximalist opt-out

## Usage

```ts
// oxlint.config.{mts,ts};
import { defineConfig } from '@jlg/oxlint';

export default defineConfig({
  ignorePatterns: ['**/*.d.ts'],
  // set at the root by the base: unused directives error, type-aware wherever typescript is installed
  options: { reportUnusedDisableDirectives: 'off', typeAware: true },
  // the base's overrides come first, so yours win, and an override beats top-level rules
  overrides: [],
  // merged over the base's; a nested oxlint.config.ts replaces the root for its subtree
  rules: {},
});
```

> Runs under Node ≥24 or Bun ≥1.4 (`bun --bun oxlint`)—JS plugins included.

> The base brings its own `oxlint-tsgolint` and points oxlint at it through `OXLINT_TSGOLINT_PATH`, which never reaches oxlint's binary under `bun --bun`: there, an isolated install lists `oxlint-tsgolint` itself or lints untyped.

Bun, Next, React, TypeScript and the Node floor come from the package.json nearest each oxlint config, walking up (`engines` from the nearest that has one), so a nested config lints with its own package's dependencies; `env` forces any of them.

A rule oxlint lacks natively is keyed by its `-js` scope—`import-js/no-internal-modules`, not `import/`—and a name oxlint has no rule for fails the whole config load.

`comments/divider` ends a `// ─── title ───` divider at oxfmt's `printWidth`, read from the oxfmt config nearest the oxlint config, walking up, in oxfmt's order (`.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts`), 100 without one; `['error', { width }]` sets it outright.

`off`, the other export, maps every rule the base turns off to the fact that turns it off.

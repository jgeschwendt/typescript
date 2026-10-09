# @jlg/oxfmt

The canonical [oxfmt](https://oxc.rs/docs/guide/usage/formatter) settings for the
`@jlg` stack — the formatter companion to `@jlg/oxlint` (oxlint owns lint, oxfmt
owns format). The base settings live in one file, `oxfmtrc.json`, consumed either
programmatically from a TS/JS config (`import { defineConfig } from "@jlg/oxfmt"` —
the primary path) or by pointing oxfmt at the raw JSON.

The base carries only the shared stack opinion (single quotes):

```json
{
  "singleQuote": true
}
```

Repo-local concerns — `printWidth`, `sortPackageJson`, `sortTailwindcss`, ignore
patterns — deliberately stay out of it; each consumer sets those in its own config
alongside the merged base.

Single quotes with as-needed property quotes are the stack style by owner
decision (2026-10-09), replacing the typescript repo's former Prettier
`quoteProps: 'consistent'` and double quotes.

Because the base carries only `singleQuote` — a key that is valid, and unchanged
in default, across the whole 0.59 → 0.67 range (verified 2026-09-08 against oxfmt
0.67's `configuration_schema.json`: one key added, none removed, no defaults
changed) and still in the 0.72 schema (verified 2026-10-09) — the package
declares a deliberately wide peer, `oxfmt >=0.59.0 <1.0.0`. A caret range (`^0.59.0`, i.e. `>=0.59.0 <0.60.0` under npm semver for
0.x) would leave every consumer on 0.60+ with an unsatisfied peer for no reason.

> **No `extends` (re-verified 2026-10-09 against oxfmt 0.72).** Unlike `@jlg/oxlint` — whose
> `oxlintrc.jsonc` composes into a consumer via `extends` — oxfmt has **no**
> `extends` mechanism: its configuration schema has no such key (checked against
> `node_modules/oxfmt/configuration_schema.json` at 0.72.0). This
> package therefore cannot be composed by reference; `defineConfig` composes it by **merge** instead (base
> first, your keys win), and the raw-JSON alternatives below either point oxfmt at
> the shipped file with `-c` or import and spread it.

## Consumption

### From a TS/JS config (recommended)

oxfmt auto-discovers and evaluates an `oxfmt.config.ts` (or `.mts`) in the
working directory as real JavaScript, so a config merges the base
programmatically:

```ts
// oxfmt.config.ts at your repo root
import { defineConfig } from '@jlg/oxfmt';

export default defineConfig({
  // Your keys layer over the base; oxfmt has no `extends`, so this is a merge.
  ignorePatterns: ['dist/**'],
  sortTailwindcss: true,
});
```

`defineConfig(config)` returns `{ ...base, ...config }` — a **shallow merge** with
the base first and your keys winning. A no-arg call (`defineConfig()`) returns a
fresh copy of the base. The raw parsed base object is also exported as `base` for
direct access (`import { base } from "@jlg/oxfmt"`).

- **Only `.ts` and `.mts` are auto-discovered** (with `.oxfmtrc.json` and
  `.oxfmtrc.jsonc`). An `oxfmt.config.{js,mjs,cjs,cts}` is ignored without
  `-c` — oxfmt prints "No config found, using defaults" and formats with
  double quotes, exit 0 — and applies when named with `-c` (verified
  2026-10-09 · probe, oxfmt 0.72).
- **Runtime.** Loading a **TypeScript** config relies on Node's native
  TypeScript stripping; run it on a Node new enough to strip types (Node 24
  verified). `bun run` and `bunx` honor the bin's node shebang; `bun --bun
  oxfmt` evaluates the config in Bun (verified 2026-10-09 · probe).

### Point oxfmt at the raw JSON with `-c`

The simplest route with no JS config — reference the shipped file directly
(verified 2026-10-09, oxfmt 0.72):

```sh
oxfmt -c node_modules/@jlg/oxfmt/oxfmtrc.json --check .
```

### Import the raw JSON and spread it

For a JS/TS config that would rather merge by hand than call `defineConfig`, import
the JSON off its **subpath** and spread it:

```ts
// oxfmt.config.ts (or .mts; any other extension needs -c)
import base from '@jlg/oxfmt/oxfmtrc.json' with { type: 'json' };

export default { ...base, sortTailwindcss: true };
```

## Relationship to the repo root

This repo's own `.oxfmtrc.jsonc` consumes the base by **mirroring its keys** (the
root file cannot `extends` this one, per the constraint above): every key in
`oxfmtrc.json` must also appear there, and the two must be edited together. The root
file additionally carries repo-local keys (`printWidth`, `sortPackageJson`,
`ignorePatterns`) that are
not part of the shipped base. The root file is JSONC (it carries explanatory
comments); this shipped file is strict JSON so it stays importable and `-c`-usable.

## Testing

`bun run --filter '@jlg/oxfmt' test` runs Bun's built-in test runner (`bun test`)
over `__tests__/`:

- **`config.test.js`** — `oxfmtrc.json` parses as strict JSON, and every key in it
  is a real oxfmt option (validated against oxfmt's own
  `configuration_schema.json`, so a typo — or a key an oxfmt bump renames — fails by
  name rather than being silently ignored).
- **`define-config.test.js`** — the JS-entry contract. Asserts `defineConfig` merges
  the base first with consumer keys winning, keeps un-overridden base keys, returns a
  fresh copy of the base with no argument, mutates neither the caller's config nor
  the base, and that the exported `base` is byte-for-byte the parsed `oxfmtrc.json`
  (so JS and raw-JSON consumers get identical settings).

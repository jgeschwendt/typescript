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
alongside the merged base (since 2026-07-22, 0.2.0; ≤0.1.0 shipped
`printWidth`/`sortPackageJson` instead).

> **No `extends` (verified 2026-07-22, oxfmt 0.59).** Unlike `@jlg/oxlint` — whose
> `oxlintrc.jsonc` composes into a consumer via `extends` — oxfmt has **no**
> `extends` mechanism: its configuration schema has no such key (confirmed against
> `node_modules/oxfmt/configuration_schema.json`). This package therefore cannot be
> composed by reference; `defineConfig` composes it by **merge** instead (base
> first, your keys win), and the raw-JSON alternatives below either point oxfmt at
> the shipped file with `-c` or import and spread it.

## Consumption

### From a TS/JS config (recommended)

oxfmt auto-discovers and evaluates an `oxfmt.config.{ts,js,mjs}` in the working
directory as real JavaScript, so a config merges the base programmatically:

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

- **oxfmt auto-discovers `oxfmt.config.ts`** — no `-c` needed (verified 2026-07-22,
  oxfmt 0.59: with `oxfmt.config.ts` present in the cwd and no `-c`, both the base
  `singleQuote` and a consumer `sortTailwindcss`/`ignorePatterns` applied). An
  earlier "not auto-discovered" note (2026-07-20) was **wrong** — it had probed
  `oxfmt.config.mjs`, not `.ts`. Whether the **`.mjs`** form is auto-discovered
  remains unverified (unverified 2026-07-22 · not re-probed since the `.ts` fix).
- **Node runtime.** Loading a **TypeScript** config (`oxfmt.config.ts`) relies on
  Node's native TypeScript stripping; run it on a Node new enough to strip types
  (Node 24 was used to verify above). A plain `.mjs` / `.js` config needs no
  stripping.

### Point oxfmt at the raw JSON with `-c`

The simplest route with no JS config — reference the shipped file directly
(verified 2026-07-22, oxfmt 0.59):

```sh
oxfmt -c node_modules/@jlg/oxfmt/oxfmtrc.json --check .
```

### Import the raw JSON and spread it

For a JS/TS config that would rather merge by hand than call `defineConfig`, import
the JSON off its **subpath** and spread it:

```js
// oxfmt.config.mjs (also works as .ts / .mts)
import base from '@jlg/oxfmt/oxfmtrc.json' with { type: 'json' };

export default { ...base, sortTailwindcss: true };
```

> **Breaking change, 0.2.0 → 0.3.0.** In 0.2.0 the package's main export (`"."`)
> resolved to the raw `oxfmtrc.json`, so consumers wrote
> `import base from '@jlg/oxfmt' with { type: 'json' }`. In 0.3.0 `"."` resolves to
> the JS entry (`defineConfig` + `base`), and the raw JSON moved to the
> **`@jlg/oxfmt/oxfmtrc.json`** subpath. A JSON import of the bare `"."` specifier
> will now load a JS module and fail — switch it to the subpath above, or migrate to
> `defineConfig`.

> **Interim install path (2026-07-19).** `@jlg/oxfmt` on npmjs is the permanent
> home. Until then the package is published to GitHub Packages under the repo
> owner's scope as **`@jgeschwendt/oxfmt`** (GitHub Packages requires the scope to
> equal the repo owner). Installed from there, the import specifier is
> `@jgeschwendt/oxfmt` (and the raw paths above become
> `node_modules/@jgeschwendt/oxfmt/oxfmtrc.json` and
> `import base from "@jgeschwendt/oxfmt/oxfmtrc.json" …`) — same files, different
> scope directory. Point your `.npmrc` at the registry for that scope:
> `@jgeschwendt:registry=https://npm.pkg.github.com`.

## Relationship to the repo root

This repo's own `.oxfmtrc.jsonc` consumes the base by **mirroring its keys** (the
root file cannot `extends` this one, per the constraint above): every key in
`oxfmtrc.json` must also appear there, and the two must be edited together. The root
file additionally carries repo-local keys (`printWidth`, `sortPackageJson`) that are
not part of the shipped base. The root file is JSONC (it carries explanatory
comments); this shipped file is strict JSON so it stays importable and `-c`-usable.

## Testing

`bun run --filter '@jlg/oxfmt' test` runs Bun's built-in test runner (`bun test`)
over `__tests__/` (migrated from `node --test` 2026-07-23):

- **`config.test.js`** — `oxfmtrc.json` parses as strict JSON, and every key in it
  is a real oxfmt option (validated against oxfmt's own
  `configuration_schema.json`, so a typo — or a key an oxfmt bump renames — fails by
  name rather than being silently ignored).
- **`define-config.test.js`** — the JS-entry contract. Asserts `defineConfig` merges
  the base first with consumer keys winning, keeps un-overridden base keys, returns a
  fresh copy of the base with no argument, mutates neither the caller's config nor
  the base, and that the exported `base` is byte-for-byte the parsed `oxfmtrc.json`
  (so JS and raw-JSON consumers get identical settings).

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

`types/prefer-readonly-generic`, on TypeScript files, writes a readonly object type `Readonly<{ a: string }>`, never `{ readonly a: string }`: it fixes a literal whose every member is `readonly`, strips the modifiers inside `Readonly<…>`, and reports a literal only some of whose members are, once per literal, for the author to wrap or split. The base writes object types as `type` literals (`typescript/consistent-type-definitions: type`), so every object type is one the rule governs; `readonly` arrays and tuples stay as written.

Functions are expressions, `const f = () => …`, except where React or Next wants a declaration: `.jsx`/`.tsx` run `func-style` at `declaration`, helpers included, with `react/function-component-definition` on, so a component is `function Button()`; Next's segment files let a named export stay an expression (`export const generateMetadata = …`), and `route`, `instrumentation`, `middleware`, `proxy` and the metadata routes (`robots`, `sitemap`, the icons and images) are declarations throughout.

`jsx-no-bind` and `react-perf` agree: an inline handler on a host element (`<button onClick={() => …}>`) passes, on a component (`<Button onClick={() => …}>`) it reports under both, once each; `jsx-no-bind` runs through the plugin host with `ignoreDOMComponents`, as `react-perf` runs with `nativeAllowList: all`.

`names/case` checks every name the code declares, on JavaScript and TypeScript alike, in the case its kind takes: camelCase by default; PascalCase for classes, interfaces, type aliases, enums, their members and type parameters; camelCase or UPPER_CASE for variables; camelCase or PascalCase for imports and object-literal properties. A parameter may lead with one underscore, and one of underscores alone passes. A `.jsx` or `.tsx` file adds PascalCase to functions, object-literal methods and properties, type properties and variables; in a `route.{js,ts}` an exported `GET`, `POST` and the other HTTP methods pass. A key that needs quotes, a computed key, a member read or assignment, and a named import kept under its own name are never checked. Its one option, `allow`, exempts a foreign name once: an entry matches as the name itself or as a regex anchored at both ends, so a snake_case boundary (a wire format, a generated client) reads `['error', { allow: ['api_\\w+'] }]`.

One import statement per module: a type-only name joins the value import inline, `import { type T, x } from 'm'`, and `import type { T }` stands alone only where a module gives types alone; `--fix` writes both.

File names are kebab-case, components included—`button.tsx`, never `Button.tsx`; Next's segment files already are.

With React on, `props`, `ref` and the `Props`/`Ref` words are not abbreviations to `unicorn-js/name-replacements`; with Next on, `params` too.

React does not imply a browser (Ink renders to a terminal): a consumer with a DOM sets `env: { browser: true }` itself.

`no-manually-wrapped-comments` joins consecutive `//` prose lines; a deliberate break ends its line with `.`, `:`, `!` or `?`, or starts the next with a list marker.

`off` maps every rule the base turns off to the fact that turns it off.

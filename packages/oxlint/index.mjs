// @jlg/oxlint — JS entry for oxlint's TS/JS config loader (Node >= 22.18).
//
// oxlint auto-discovers an `oxlint.config.ts` (or `.mts`) and evaluates it as
// real JavaScript (other extensions load only with `-c`), so a consumer can `import { defineConfig } from "@jlg/oxlint"` and compose the base
// programmatically instead of hand-writing an `extends` path in a JSON config.
//
// `oxlintrc.jsonc` (shipped alongside this file) stays the single source of
// truth for the base ruleset; it is parsed here so the JS entry and the
// raw-JSONC entry (`@jlg/oxlint/oxlintrc.jsonc`) can never drift.

import { parse } from 'jsonc-parser';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the JSONC relative to THIS module (it ships next to index.mjs), not
// the consumer's cwd. jsonc-parser is fault-tolerant — a malformed document
// yields partial/`undefined` data rather than throwing — so surface parse errors
// ourselves and fail loudly instead of shipping a silently-empty base.
const source = readFileSync(new URL('oxlintrc.jsonc', import.meta.url), 'utf8');
const errors = [];
const parsed = parse(source, errors, { allowTrailingComma: true });
if (errors.length > 0) {
  throw new Error(
    `@jlg/oxlint: oxlintrc.jsonc failed to parse: ${JSON.stringify(errors)}`,
  );
}

// `jsPlugins` entries resolve against the config file that declares them, and
// in a JS config the base arrives as an object with no file of its own — so the
// consumer's directory would be searched for `./plugins/*.mjs`. Every entry is
// a path relative to oxlintrc.jsonc (plugins/ wraps the plugin packages, so no
// entry is a bare specifier); pin each to an absolute path resolved from here.
// An aliased entry object is this module's own parse, so it is updated in place.
const absolute = (specifier) =>
  fileURLToPath(new URL(specifier, import.meta.url));

// The parsed base config object, its jsPlugins paths absolutized, exported for
// consumers who want raw access (merge fields by hand, inspect the ruleset).
// ※ oxlint-base
const base = {
  ...parsed,
  jsPlugins: (parsed.jsPlugins ?? []).map((entry) =>
    typeof entry === 'string'
      ? absolute(entry)
      : Object.assign(entry, { specifier: absolute(entry.specifier) }),
  ),
};

/** An override glob scoped by extension alone: any directory, then `*.<ext>`. */
const byExtension = /^\*\*\/\*\.[^/]+$/u;
/**
 * The base overrides scoped by file name: Next routing files, route naming,
 * tooling configs. They must beat the consumer's overrides (oxlintrc.jsonc,
 * ORDER).
 */
const trailing = (base.overrides ?? []).filter(
  (override) => !override.files.every((glob) => byExtension.test(glob)),
);

/**
 * `settings.react` for the consumer's installed React: its `version`, what
 * @jlg/eslint's `version: "detect"` resolved to. oxlint accepts only a semver
 * there ("invalid major version" for "detect"), and without one
 * eslint-plugin-react warns and assumes the latest React. Empty without React.
 */
const detectReact = () => {
  try {
    const require = createRequire(join(process.cwd(), 'package.json'));
    const { version } = require('react/package.json');
    const semver = /^\d+\.\d+\.\d+/u.exec(version);
    return semver === null ? {} : { version: semver[0] };
  } catch {
    return {};
  }
};

// Compose the base with a consumer config.
//
// In a JS/TS oxlint config, `extends` takes config OBJECTS, not path strings —
// oxlint's js_config loader resolves each entry as an in-memory config and
// rejects a bare string (verified 2026-10-09 · oxlint 1.87). (The JSON loader is the opposite: there `extends` is an
// array of file paths.) So the base is spread in as an object here, and any
// `extends` the consumer supplied is preserved AFTER it, letting user configs
// still compose on top. (2026-07-20)
//
// Two things `extends` cannot carry are put into the returned root config:
// the base's file-named overrides, re-appended after the consumer's so they
// win as they did under @jlg/eslint; and `settings`, which oxlint reads from
// the root config only (an extended config's `settings` are dropped — as are
// its top-level `env` and `globals`; the base carries `env` in an override
// instead). The consumer's own settings win.
// ※ oxlint-extends-objects
const defineConfig = (config = {}) => {
  const react = {
    ...detectReact(),
    ...base.settings?.react,
    ...config.settings?.react,
  };
  return {
    ...config,
    extends: [base, ...(config.extends ?? [])],
    overrides: [...(config.overrides ?? []), ...trailing],
    settings: {
      ...base.settings,
      ...config.settings,
      ...(Object.keys(react).length === 0 ? {} : { react }),
    },
  };
};

export { base, defineConfig };

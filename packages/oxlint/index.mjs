// @jlg/oxlint — JS entry for oxlint's TS/JS config loader (Node >= 22.18).
//
// oxlint evaluates a `oxlint.config.{ts,js,mjs}` as real JavaScript, so a
// consumer can `import { defineConfig } from "@jlg/oxlint"` and compose the base
// programmatically instead of hand-writing an `extends` path in a JSON config.
//
// `oxlintrc.jsonc` (shipped alongside this file) stays the single source of
// truth for the base ruleset; it is parsed here so the JS entry and the
// raw-JSONC entry (`@jlg/oxlint/oxlintrc.jsonc`) can never drift.

import { readFileSync } from 'node:fs';
import { parse } from 'jsonc-parser';

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

// The parsed base config object, exported for consumers who want raw access
// (merge fields by hand, inspect the ruleset, etc.).
// stele:landmark oxlint-base
const base = parsed;

// Compose the base with a consumer config.
//
// In a JS/TS oxlint config, `extends` takes config OBJECTS, not path strings —
// oxlint 1.74's js_config loader resolves each entry as an in-memory config and
// rejects a bare string. (The JSON loader is the opposite: there `extends` is an
// array of file paths.) So the base is spread in as an object here, and any
// `extends` the consumer supplied is preserved AFTER it, letting user configs
// still compose on top. (2026-07-20)
// stele:landmark oxlint-extends-objects
const defineConfig = (config = {}) => ({
  ...config,
  extends: [base, ...(config.extends ?? [])],
});

export { base, defineConfig };

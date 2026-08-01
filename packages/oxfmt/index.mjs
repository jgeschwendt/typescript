// @jlg/oxfmt — JS entry for oxfmt's TS/JS config loader.
//
// oxfmt auto-discovers and evaluates an `oxfmt.config.{ts,js,mjs}` as real
// JavaScript, so a consumer can `import { defineConfig } from "@jlg/oxfmt"` and
// merge the base programmatically instead of importing the raw JSON and
// spreading it by hand.
//
// `oxfmtrc.json` (shipped alongside this file) stays the single source of truth
// for the base settings; it is parsed here so the JS entry and the raw-JSON
// entry (`@jlg/oxfmt/oxfmtrc.json`) can never drift.

import { readFileSync } from 'node:fs';

// Resolve the JSON relative to THIS module (it ships next to index.mjs), not the
// consumer's cwd. oxfmtrc.json is strict JSON — no comments, no trailing commas
// — so JSON.parse suffices and this entry stays dependency-free (no jsonc-parser,
// unlike @jlg/oxlint whose base is JSONC).
const base = JSON.parse(
  readFileSync(new URL('oxfmtrc.json', import.meta.url), 'utf8'),
);

// Merge the base with a consumer config. Unlike oxlint, oxfmt has NO `extends`
// mechanism, so composition is a shallow merge: base first, consumer keys win.
// A fresh object is returned each call, so the exported `base` is never mutated
// and no two callers share a reference.
const defineConfig = (config = {}) => ({ ...base, ...config });

export { base, defineConfig };

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { base, defineConfig } from '../index.mjs';

const configPath = join(import.meta.dirname, '..', 'oxfmtrc.json');

// The JS entry (`import { defineConfig } from "@jlg/oxfmt"`) is the consumption
// path for TS/JS oxfmt configs. It parses the package's own oxfmtrc.json — the
// single source of truth — and shallow-merges it UNDER the consumer config.
// oxfmt has no `extends`, so composition is a merge, not a reference: base
// first, consumer keys win. These guard that merge contract, plus that the
// exported `base` is the verbatim parsed JSON (so JS and raw-JSON consumers get
// identical settings).

test('base export matches parsing oxfmtrc.json directly', () => {
  expect(base).toStrictEqual(JSON.parse(readFileSync(configPath, 'utf8')));
});

test('defineConfig merges base first — consumer keys win', () => {
  const config = defineConfig({ singleQuote: false, sortTailwindcss: true });
  expect(config).toStrictEqual({
    singleQuote: false,
    sortTailwindcss: true,
  });
});

test('defineConfig keeps base keys the consumer did not override', () => {
  const config = defineConfig({ sortTailwindcss: true });
  expect(config.singleQuote).toBe(base.singleQuote);
  expect(config.sortTailwindcss).toBe(true);
});

test('defineConfig with no argument returns a copy of the base', () => {
  const config = defineConfig();
  expect(config).toStrictEqual(base);
  expect(config).not.toBe(base);
});

test("defineConfig mutates neither the caller's config nor the base", () => {
  const input = { sortTailwindcss: true };
  const config = defineConfig(input);
  expect(input).toStrictEqual({ sortTailwindcss: true });
  expect(config).not.toBe(input);
  expect(base).toStrictEqual({ singleQuote: true });
});

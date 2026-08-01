import { expect, test } from 'bun:test';
import { base, defineConfig } from '../index.mjs';
import { loadConfig } from './_lib.js';

// The JS entry (`import { defineConfig } from "@jlg/oxlint"`) is the consumption
// path for TS/JS oxlint configs. It parses the package's own oxlintrc.jsonc —
// the single source of truth — and prepends it to the consumer's `extends`.
// These guard that composition contract, plus that the exported `base` is the
// verbatim parsed JSONC (so JS and raw-JSONC consumers get identical rulesets).

test('base export matches parsing oxlintrc.jsonc directly', () => {
  expect(base).toStrictEqual(loadConfig());
});

test('defineConfig puts base as the first extends entry', () => {
  const config = defineConfig({ rules: { 'no-void': 'off' } });
  expect(config.extends[0]).toStrictEqual(base);
  expect(config.rules).toStrictEqual({ 'no-void': 'off' });
});

test('defineConfig appends user-supplied extends after base', () => {
  const userExtend = { rules: { 'no-console': 'error' } };
  const config = defineConfig({ extends: [userExtend] });
  expect(config.extends).toStrictEqual([base, userExtend]);
});

test('defineConfig with no argument still composes the base', () => {
  expect(defineConfig().extends).toStrictEqual([base]);
});

test("defineConfig does not mutate the caller's config", () => {
  const input = { extends: [], rules: {} };
  const config = defineConfig(input);
  expect(input.extends).toStrictEqual([]);
  expect(config.extends).not.toBe(input.extends);
});

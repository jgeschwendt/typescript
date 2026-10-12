import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { base, defineConfig } from '../index.mjs';

const configPath = join(import.meta.dirname, '..', 'oxfmtrc.json');

test('base export matches parsing oxfmtrc.json directly', () => {
  expect(base).toStrictEqual(JSON.parse(readFileSync(configPath)));
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

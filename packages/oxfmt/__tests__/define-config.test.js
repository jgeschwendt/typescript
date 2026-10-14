import { expect, test } from 'bun:test';
import { defineConfig } from '../index.js';

const { readFileSync } = process.getBuiltinModule('node:fs');
const raw = readFileSync(new URL('../oxfmtrc.json', import.meta.url));
const base = JSON.parse(String(raw));

test('defineConfig() is a fresh copy of oxfmtrc.json', () => {
  const config = defineConfig();
  expect(config).toStrictEqual(base);
  expect(config).not.toBe(defineConfig());
});

test('consumer keys win over the base; the rest of the base stays', () => {
  expect(defineConfig({ singleQuote: false, sortTailwindcss: true })).toStrictEqual({
    singleQuote: false,
    sortTailwindcss: true,
  });
  expect(defineConfig({ sortTailwindcss: true })).toStrictEqual({ ...base, sortTailwindcss: true });
});

test("defineConfig leaves the caller's object untouched", () => {
  const input = { sortTailwindcss: true };
  expect(defineConfig(input)).not.toBe(input);
  expect(input).toStrictEqual({ sortTailwindcss: true });
});

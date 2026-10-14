import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { config as parsed, write } from './_helpers.js';
import { base, defineConfig } from '../index.mjs';

// The JS entry (`import { defineConfig } from "@jlg/oxlint"`) is the consumption
// path for TS/JS oxlint configs. It parses the package's own oxlintrc.jsonc —
// the single source of truth — prepends it to the consumer's `extends`, and
// lifts into the root what `extends` cannot carry. These guard that
// composition contract, plus that the exported `base` is the parsed JSONC with
// only its plugin paths absolutized (so JS and raw-JSONC consumers get
// identical rulesets).

test('base export matches parsing oxlintrc.jsonc directly', () => {
  const { jsPlugins, ...rest } = base;
  const { jsPlugins: declared, ...expected } = parsed;
  expect(rest).toStrictEqual(expected);
  expect(jsPlugins).toHaveLength(declared.length);
});

// A JS config hands oxlint the base as an object, with no file to resolve
// relative entries against — so every jsPlugins path must already be absolute.
test('base jsPlugins entries are absolute paths', () => {
  expect(
    base.jsPlugins
      .map((entry) => entry.specifier ?? entry)
      .filter((path) => !isAbsolute(path)),
  ).toEqual([]);
});

test("defineConfig prepends base to the consumer's extends and keeps its rules", () => {
  const extend = { rules: { 'no-console': 'error' } };
  const config = defineConfig({
    extends: [extend],
    rules: { 'no-void': 'off' },
  });
  expect(defineConfig().extends).toStrictEqual([base]);
  expect(config.extends).toStrictEqual([base, extend]);
  expect(config.rules).toStrictEqual({ 'no-void': 'off' });
});

test("defineConfig does not mutate the caller's config", () => {
  const input = { extends: [], rules: {} };
  const config = defineConfig(input);
  expect(input.extends).toStrictEqual([]);
  expect(config.extends).not.toBe(input.extends);
});

// the base overrides scoped by file name, which must beat the consumer's
const fileNamed = base.overrides.filter(
  (override) =>
    !override.files.every((glob) => /^\*\*\/\*\.[^/]+$/u.test(glob)),
);

test("defineConfig re-appends the file-named base overrides after the consumer's", () => {
  const own = { files: ['**/*.tsx'], rules: { 'no-void': 'off' } };
  const config = defineConfig({ overrides: [own] });
  expect(config.overrides).toStrictEqual([own, ...fileNamed]);
  const globs = fileNamed.flatMap((override) => override.files);
  expect(globs).toContain('**/route.ts');
  expect(globs).not.toContain('**/*.tsx');
});

const react = {
  'node_modules/react/package.json': JSON.stringify({
    name: 'react',
    version: '19.3.0-canary-1',
  }),
};

test.each([
  {
    files: react,
    input: {},
    settings: { react: { version: '19.3.0' } },
    source: 'the installed React',
  },
  {
    files: react,
    input: { settings: { react: { version: '18.2.0' } } },
    settings: { react: { version: '18.2.0' } },
    source: 'the consumer over the installed React',
  },
  { files: {}, input: {}, settings: {}, source: 'nothing without React' },
])(
  'defineConfig takes settings.react from $source',
  ({ files, input, settings }) => {
    const directory = mkdtempSync(join(tmpdir(), 'oxlint-react-'));
    const cwd = process.cwd();
    try {
      write(directory, files);
      process.chdir(directory);
      expect(defineConfig(input).settings).toStrictEqual(settings);
    } finally {
      process.chdir(cwd);
      rmSync(directory, { force: true, recursive: true });
    }
  },
);

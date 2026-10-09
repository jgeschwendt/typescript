import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { loadConfig } from './_helpers.js';
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
  const { jsPlugins: declared, ...expected } = loadConfig();
  expect(rest).toStrictEqual(expected);
  expect(jsPlugins).toHaveLength(declared.length);
});

// A JS config hands oxlint the base as an object, with no file to resolve
// relative entries against — so every jsPlugins path must already be absolute.
test('base jsPlugins entries are absolute paths', () => {
  const paths = base.jsPlugins.map((entry) =>
    typeof entry === 'string' ? entry : entry.specifier,
  );
  expect(paths.filter((path) => !isAbsolute(path))).toEqual([]);
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

// the base overrides scoped by file name, which must beat the consumer's
const fileNamed = base.overrides.filter(
  (override) =>
    !override.files.every((glob) => /^\*\*\/\*\.[^/]+$/u.test(glob)),
);

test("defineConfig re-appends the file-named base overrides after the consumer's", () => {
  const own = { files: ['**/*.tsx'], rules: { 'no-void': 'off' } };
  const config = defineConfig({ overrides: [own] });
  expect(config.overrides).toStrictEqual([own, ...fileNamed]);
  expect(fileNamed.flatMap((override) => override.files)).toContain(
    '**/route.ts',
  );
  expect(fileNamed.flatMap((override) => override.files)).not.toContain(
    '**/*.tsx',
  );
});

test('defineConfig sets settings.react.version from the installed React', () => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-react-'));
  const cwd = process.cwd();
  try {
    mkdirSync(join(directory, 'node_modules', 'react'), { recursive: true });
    writeFileSync(
      join(directory, 'node_modules', 'react', 'package.json'),
      JSON.stringify({ name: 'react', version: '19.3.0-canary-1' }),
    );
    process.chdir(directory);
    expect(defineConfig().settings.react).toStrictEqual({ version: '19.3.0' });
    expect(
      defineConfig({ settings: { react: { version: '18.2.0' } } }).settings
        .react,
    ).toStrictEqual({ version: '18.2.0' });
  } finally {
    process.chdir(cwd);
    rmSync(directory, { force: true, recursive: true });
  }
});

test('defineConfig leaves settings.react unset without an installed React', () => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-react-'));
  const cwd = process.cwd();
  try {
    process.chdir(directory);
    expect(defineConfig().settings).toStrictEqual({});
  } finally {
    process.chdir(cwd);
    rmSync(directory, { force: true, recursive: true });
  }
});

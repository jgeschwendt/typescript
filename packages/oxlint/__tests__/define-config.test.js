import { expect, test } from 'bun:test';
import { config, everything, overrides } from './_helpers.js';
import { defineConfig } from '../index.js';

const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');
const { dirname, isAbsolute, join } = process.getBuiltinModule('node:path');

/**
runs `run` one directory below `files`, so detection has to walk up
@template T
@param {Record<string, unknown>} files
@param {() => T} run
*/
const within = (files, run) => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-define-'));
  const cwd = process.cwd();
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, name)), { recursive: true });
    writeFileSync(join(directory, name), JSON.stringify(content));
  }
  mkdirSync(join(directory, 'nested'));
  try {
    process.chdir(join(directory, 'nested'));
    return run();
  } finally {
    process.chdir(cwd);
    rmSync(directory, { force: true, recursive: true });
  }
};

const markers = { next: '**/route.ts', react: '**/*.tsx', typescript: '**/*.{cts,mts,ts,tsx}' };
/** @param {import('oxlint').OxlintConfig} built */
const environment = (built) => {
  const globs = new Set((built.overrides ?? []).flatMap((override) => override.files));
  return Object.fromEntries(Object.entries(markers).map(([key, glob]) => [key, globs.has(glob)]));
};

// a JS config hands oxlint an object, with no file to resolve relative entries against
test('jsPlugins entries are absolute paths', () => {
  const paths = (config.jsPlugins ?? []).map((entry) =>
    typeof entry === 'string' ? entry : entry.specifier,
  );
  expect(paths.filter((path) => !isAbsolute(path))).toEqual([]);
});

test('jsPlugins run the rules oxlint lacks, never one it ports', () => {
  expect(config.rules).toMatchObject({ 'unicorn-js/consistent-boolean-name': 'error' });
  expect(config.rules).not.toContainAnyKeys(['eslint-js/no-var', 'unicorn-js/no-null']);
});

const none = { next: false, react: false, typescript: false };
test.each([
  { expected: everything, files: {}, title: 'no package.json turns everything on' },
  { expected: none, files: { 'package.json': {} }, title: 'no dependencies turn everything off' },
  {
    expected: { ...none, react: true, typescript: true },
    files: {
      'package.json': { dependencies: { react: '*' }, devDependencies: { typescript: '*' } },
    },
    title: 'dependencies and devDependencies both count',
  },
  {
    expected: { ...none, next: true },
    files: { 'package.json': {} },
    forced: { next: true },
    title: 'env overrides detection',
  },
])('$title', ({ expected, files, forced }) => {
  expect(within(files, () => environment(defineConfig({ env: forced })))).toStrictEqual(expected);
});

test('consumer config merges over the base; its overrides come last', () => {
  /** @type {import('oxlint').OxlintOverride} */
  const own = { files: ['**/*.tsx'], rules: { 'no-void': 'off' } };
  const built = defineConfig({
    categories: { style: 'off' },
    env: everything,
    overrides: [own],
    rules: { 'no-void': 'off' },
  });
  expect(built.overrides).toStrictEqual([...overrides, own]);
  expect(built.rules).toStrictEqual({ ...config.rules, 'no-void': 'off' });
  expect(built.categories).toStrictEqual({ ...config.categories, style: 'off' });
});

test("env keeps oxlint's own environments and drops next/react/typescript", () => {
  expect(defineConfig({ env: { browser: true, next: true } }).env).toStrictEqual({ browser: true });
  expect(defineConfig({ env: { react: false } })).not.toHaveProperty('env');
});

test('settings.react.version comes from the installed React; consumer settings win', () => {
  within(
    { 'node_modules/react/package.json': { name: 'react', version: '19.3.0-canary-1' } },
    () => {
      expect(defineConfig().settings).toStrictEqual({ react: { version: '19.3.0' } });
      expect(
        defineConfig({ settings: { next: {}, react: { version: '18.2.0' } } }).settings,
      ).toStrictEqual({ next: {}, react: { version: '18.2.0' } });
    },
  );
  expect(within({}, () => defineConfig().settings)).toStrictEqual({});
});

import { expect, test } from 'bun:test';
import { config, everything, overrides, write } from './_helpers.js';
import { defineConfig } from '../index.js';

const { mkdtempSync, rmSync } = process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');
const { join } = process.getBuiltinModule('node:path');

/**
runs `run` one directory below `files`, so detection has to walk up
@template T
@param {Record<string, unknown>} files
@param {() => T} run
*/
const within = (files, run) => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-define-'));
  const cwd = process.cwd();
  write(directory, { ...files, 'nested/.keep': '' });
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

test('jsPlugins never run a rule oxlint ports or upstream deprecated', () => {
  expect(config.rules).not.toContainAnyKeys([
    'eslint-js/arrow-parens',
    'eslint-js/no-var',
    'unicorn-js/no-null',
  ]);
});

test('overrides', () => {
  expect(overrides).toMatchSnapshot();
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
    jsPlugins: ['./own.mjs'],
    overrides: [own],
    rules: { 'no-void': 'off' },
  });
  expect(built.jsPlugins).toStrictEqual([...(config.jsPlugins ?? []), './own.mjs']);
  expect(built.overrides).toStrictEqual([...overrides, own]);
  expect(built.rules).toStrictEqual({ ...config.rules, 'no-void': 'off' });
  expect(built.categories).toStrictEqual({ ...config.categories, style: 'off' });
});

test("env keeps oxlint's own environments and drops next/react/typescript", () => {
  expect(defineConfig({ env: { browser: true, next: true } }).env).toStrictEqual({ browser: true });
  expect(defineConfig({ env: { react: false } })).not.toHaveProperty('env');
});

test('settings.react.version comes from the installed React, else a far-future semver; consumer settings win', () => {
  within(
    { 'node_modules/react/package.json': { name: 'react', version: '19.3.0-canary-1' } },
    () => {
      expect(defineConfig().settings).toStrictEqual({ react: { version: '19.3.0' } });
      expect(
        defineConfig({ settings: { next: {}, react: { version: '18.2.0' } } }).settings,
      ).toStrictEqual({ next: {}, react: { version: '18.2.0' } });
    },
  );
  expect(within({}, () => defineConfig().settings)).toStrictEqual({
    react: { version: '999.999.999' },
  });
});

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
const within = async (files, run) => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-define-'));
  const cwd = process.cwd();
  write(directory, { ...files, 'nested/.keep': '' });
  try {
    process.chdir(join(directory, 'nested'));
    return await run();
  } finally {
    process.chdir(cwd);
    rmSync(directory, { force: true, recursive: true });
  }
};

/** a glob or global only that environment's overrides carry */
const markers = {
  bun: 'Bun',
  next: '**/route.ts',
  react: '**/*.tsx',
  typescript: '**/*.{cts,mts,ts,tsx}',
};
/** @param {import('oxlint').OxlintConfig} built */
const environment = (built) => {
  const list = built.overrides ?? [];
  const seen = new Set([
    ...list.flatMap((override) => override.files),
    ...list.flatMap((override) => Object.keys(override.globals ?? {})),
  ]);
  return Object.fromEntries(
    Object.entries(markers).map(([key, marker]) => [key, seen.has(marker)]),
  );
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

const none = { bun: false, next: false, react: false, typescript: false };
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
    expected: { ...none, bun: true },
    files: { 'package.json': { devDependencies: { '@types/bun': '*' } } },
    title: '@types/bun detects Bun',
  },
  {
    expected: { ...none, bun: true },
    files: { 'bun.lock': {}, 'package.json': {} },
    title: 'bun.lock detects Bun',
  },
  {
    expected: { ...none, bun: true },
    files: { 'bun.lockb': {}, 'package.json': {} },
    title: 'bun.lockb detects Bun',
  },
  {
    expected: { ...none, next: true },
    files: { 'package.json': {} },
    forced: { bun: false, next: true },
    title: 'env overrides detection',
  },
])('$title', async ({ expected, files, forced }) => {
  expect(await within(files, () => environment(defineConfig({ env: forced })))).toStrictEqual(
    expected,
  );
});

/** Node's LTS, below the 26 floors */
const lts = 24;
const above26 = ['unicorn-js/prefer-iterator-zip'];
const above24 = [
  ...above26,
  'unicorn-js/prefer-get-or-insert-computed',
  'unicorn-js/prefer-iterator-concat',
  'unicorn-js/prefer-temporal',
  'unicorn-js/prefer-temporal-conversion',
  'unicorn-js/prefer-uint8array-base64',
  'unicorn-js/prefer-uint8array-hex',
];
const above22 = [
  ...above24,
  'unicorn-js/prefer-dispose',
  'unicorn-js/prefer-error-is-error',
  'unicorn-js/prefer-promise-try',
  'unicorn-js/prefer-regexp-escape',
];
const gated = [
  ...above22,
  'unicorn-js/prefer-array-from-async',
  'unicorn-js/prefer-group-by',
  'unicorn-js/prefer-iterator-helpers',
  'unicorn-js/prefer-iterator-to-array',
  'unicorn-js/prefer-iterator-to-array-at-end',
  'unicorn-js/prefer-promise-with-resolvers',
  'unicorn-js/prefer-set-methods',
];
/** @param {Record<string, unknown>} engines */
const manifest = (engines) => ({ 'package.json': { engines } });
test.each([
  { expected: [], files: { 'package.json': {} }, title: 'no engines keeps every API rule' },
  { expected: [], files: manifest({ node: '*' }), title: 'an unparsable engines.node keeps them' },
  { expected: gated, files: manifest({ node: '>=20' }), title: 'Node 20 is below every floor' },
  {
    expected: above22,
    files: manifest({ node: '^22.22.1 || >=24' }),
    title: 'Node 22 clears its floor',
  },
  { expected: above24, files: manifest({ node: '>=24' }), title: 'Node 24 clears Error.isError' },
  {
    expected: above26,
    files: manifest({ node: '^26.1.0' }),
    title: 'Node 26 lacks only Iterator.zip',
  },
  { expected: [], files: manifest({ bun: '>=1.4' }), title: 'engines.bun alone meets every floor' },
  {
    expected: above24,
    files: { ...manifest({ node: '>=24' }), 'nested/package.json': { name: 'leaf' } },
    title: 'a workspace package without engines takes the floor from above',
  },
  {
    expected: above24,
    files: manifest({ node: '>=26' }),
    forced: { node: lts },
    title: 'env.node forces the major',
  },
  {
    expected: [],
    files: manifest({ node: '24.x' }),
    forced: { bun: true },
    title: 'env.bun meets every floor',
  },
])('$title', async ({ expected, files, forced }) => {
  const { rules = {} } = await within(files, () => defineConfig({ env: forced }));
  expect(gated.filter((key) => rules[key] === 'off')).toStrictEqual([...expected]);
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

test("env keeps oxlint's own environments and drops bun/next/react/typescript and a numeric node", () => {
  expect(defineConfig({ env: { browser: true, next: true, node: false } }).env).toStrictEqual({
    browser: true,
    node: false,
  });
  expect(defineConfig({ env: { node: lts, react: false } })).not.toHaveProperty('env');
});

test('settings.react.version comes from the installed React, else a far-future semver; consumer settings win', async () => {
  await within(
    { 'node_modules/react/package.json': { name: 'react', version: '19.3.0-canary-1' } },
    () => {
      expect(defineConfig().settings).toStrictEqual({ react: { version: '19.3.0' } });
      expect(
        defineConfig({ settings: { next: {}, react: { version: '18.2.0' } } }).settings,
      ).toStrictEqual({ next: {}, react: { version: '18.2.0' } });
    },
  );
  expect(await within({}, () => defineConfig().settings)).toStrictEqual({
    react: { version: '999.999.999' },
  });
});

/** @type {import('oxlint').OxlintConfig['options']} */
const options = { reportUnusedDisableDirectives: 'error', typeAware: false };
const typed = { devDependencies: { 'oxlint-tsgolint': '*', typescript: '*' } };
test.each([
  { title: 'a config outside the lint root sets no options' },
  { expected: options, root: true, title: 'root forces them' },
  {
    expected: options,
    files: { 'package.json': { devDependencies: { typescript: '*' } } },
    root: true,
    title: 'typescript without oxlint-tsgolint is not type-aware',
  },
  {
    expected: { ...options, typeAware: true },
    files: { 'package.json': typed },
    root: true,
    title: 'typescript and oxlint-tsgolint are type-aware',
  },
  {
    expected: options,
    files: { 'package.json': typed },
    options: { typeAware: false },
    root: true,
    title: "the consumer's options win",
  },
])('$title', async ({ expected, files = {}, ...own }) => {
  expect(await within(files, () => defineConfig(own).options)).toStrictEqual(expected);
});

/** a root config in the temp dir: the divider's width resolves from its caller's directory up */
const plain = `import { defineConfig } from '${join(import.meta.dirname, '..', 'index.js')}';
export default defineConfig();`;
/** oxfmt's default, then the widths configs set */
const printWidth = 100;
const narrow = 80;
const jsonc = 90;
const wide = 120;
const typedWide = `const width: number = ${wide};\nexport default { printWidth: width };\n`;
test.each([
  { expected: printWidth, files: {}, title: 'no oxfmt config divides at 100' },
  { expected: printWidth, files: { '.oxfmtrc.json': {} }, title: 'no printWidth divides at 100' },
  {
    expected: narrow,
    files: { '.oxfmtrc.json': { printWidth: narrow }, 'oxfmt.config.ts': typedWide },
    title: ".oxfmtrc.json comes first in oxfmt's order",
  },
  {
    expected: jsonc,
    files: {
      '.oxfmtrc.jsonc': `{\n  "$schema": "https://oxc.rs/schema.json", // url\n  /* width */ "printWidth": ${jsonc}\n}\n`,
    },
    title: 'JSONC strips comments, never a // inside a string',
  },
  { expected: wide, files: { 'oxfmt.config.ts': typedWide }, title: 'a TS config is required' },
])('$title', async ({ expected, files }) => {
  const { default: built } = await within(
    { ...files, 'nested/oxlint.config.js': plain },
    () => import(join(process.cwd(), 'oxlint.config.js')),
  );
  expect(built.rules['comments/divider']).toStrictEqual(['error', { width: expected }]);
});

/** a shared config wrapping the base, as a consumer's oxlint.config.js loads it */
const wrapper = `import { defineConfig } from '${join(import.meta.dirname, '..', 'index.js')}';
export default (config) => defineConfig(config);`;
test.each([
  {
    expected: options,
    path: 'oxlint.config.js',
    title: 'the config in cwd through a wrapper is the root',
  },
  { path: 'sub/oxlint.config.js', title: 'a config below cwd through a wrapper is not' },
])('$title', async ({ expected, path }) => {
  const entry = `import wrap from '${path.includes('/') ? '../' : './'}wrapper.js';
export default wrap();`;
  const { default: wrapped } = await within(
    { [`nested/${path}`]: entry, 'nested/wrapper.js': wrapper },
    () => import(join(process.cwd(), path)),
  );
  expect(wrapped.options).toStrictEqual(expected);
});

test("the config in oxlint's cwd is the root unless root: false", () => {
  const cwd = process.cwd();
  process.chdir(import.meta.dirname);
  try {
    expect(defineConfig().options).toStrictEqual(options);
    expect(defineConfig({ root: false })).not.toHaveProperty('options');
  } finally {
    process.chdir(cwd);
  }
});

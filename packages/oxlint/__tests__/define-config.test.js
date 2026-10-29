import { afterAll, expect, test } from 'bun:test';
import { config, everything, overrides, within } from './_helpers.js';
import { defineConfig, namingConvention } from '../index.js';

const { existsSync } = process.getBuiltinModule('node:fs');

/** a glob or global only that environment's overrides carry */
const markers = {
  bun: 'Bun',
  next: '**/route.{js,ts}',
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

/**
the naming-convention tuple of the override for `files`
@param {string} files
*/
const tuple = (files) =>
  overrides.find((override) => override.files.includes(files))?.rules?.[
    'typescript-js/naming-convention'
  ];
test('namingConvention is the tail of every naming-convention tuple', () => {
  expect({
    default: tuple('**/*.{cts,mts,ts,tsx}'),
    route: tuple('**/route.{js,ts}'),
    tsx: tuple('**/*.tsx'),
  }).toStrictEqual({
    default: ['warn', ...namingConvention.default],
    route: ['warn', ...namingConvention.route],
    tsx: ['warn', ...namingConvention.tsx],
  });
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
  {
    expected: none,
    files: { 'nested/leaf/package.json': {}, 'package.json': { dependencies: { react: '*' } } },
    path: 'leaf/oxlint.config.js',
    title: "a nested config detects from its own directory, not oxlint's cwd",
  },
])('$title', async ({ expected, files, forced, path }) => {
  expect(environment(await within(files, { env: forced }, path))).toStrictEqual(expected);
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
  const { rules = {} } = await within(files, { env: forced });
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

/** @param {string} version */
const react = (version) => ({ name: 'react', version });
const installed = { 'node_modules/react/package.json': react('19.3.0-canary-1') };
test.each([
  {
    expected: { react: { version: '19.3.0' } },
    files: installed,
    title: 'settings.react.version comes from the installed React',
  },
  {
    expected: { react: { version: '18.2.0' } },
    files: { ...installed, 'nested/leaf/node_modules/react/package.json': react('18.2.0') },
    path: 'leaf/oxlint.config.js',
    title: "a nested config resolves its own React, not oxlint's cwd's",
  },
  {
    expected: { next: {}, react: { version: '18.2.0' } },
    files: installed,
    settings: { next: {}, react: { version: '18.2.0' } },
    title: 'consumer settings win',
  },
  {
    expected: { react: { version: '999.999.999' } },
    files: {},
    title: 'no React gets a far-future semver',
  },
])('$title', async ({ expected, files, path, settings }) => {
  const built = await within(files, { settings }, path);
  expect(built.settings).toStrictEqual(expected);
});

/** @type {import('oxlint').OxlintConfig['options']} */
const options = { reportUnusedDisableDirectives: 'error', typeAware: false };
const typed = { devDependencies: { 'oxlint-tsgolint': '*', typescript: '*' } };
test.each([
  { expected: options, title: 'the config in cwd through a wrapper is the root' },
  { path: 'sub/oxlint.config.js', title: 'a config below cwd through a wrapper is not' },
  { expected: options, path: 'sub/oxlint.config.js', root: true, title: 'root forces them' },
  { root: false, title: 'root: false drops them' },
  {
    expected: { ...options, typeAware: true },
    files: {
      'node_modules/.bin/tsgolint': '',
      'package.json': { devDependencies: { typescript: '*' } },
    },
    title: "typescript alone is type-aware through the base's tsgolint",
  },
  {
    expected: options,
    files: { 'package.json': { devDependencies: { typescript: '*' } } },
    title: 'on Bun, only a node_modules/.bin/tsgolint oxlint finds makes it type-aware',
  },
  {
    expected: { ...options, typeAware: true },
    files: { 'package.json': typed },
    title: 'typescript and oxlint-tsgolint are type-aware',
  },
  {
    expected: options,
    files: { 'package.json': typed },
    options: { typeAware: false },
    title: "the consumer's options win",
  },
])('$title', async ({ expected, files = {}, path, ...own }) => {
  const built = await within(files, own, path);
  expect(built.options).toStrictEqual(expected);
});

/** set by defineConfig in this process, so cleared after: spawned oxlint runs inherit the environment */
const tsgolintVariable = 'OXLINT_TSGOLINT_PATH';
afterAll(() => Reflect.deleteProperty(process.env, tsgolintVariable));
test.each([
  {
    devDependencies: typed.devDependencies,
    expected: false,
    title: "a consumer's own oxlint-tsgolint leaves OXLINT_TSGOLINT_PATH alone",
  },
  {
    devDependencies: { typescript: '*' },
    expected: true,
    title: "typescript alone points OXLINT_TSGOLINT_PATH at the base's tsgolint",
  },
])('$title', async ({ devDependencies, expected }) => {
  Reflect.deleteProperty(process.env, tsgolintVariable);
  await within({ 'package.json': { devDependencies } });
  expect(existsSync(process.env[tsgolintVariable] ?? '')).toBe(expected);
});

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
    files: { '.oxfmtrc.json': `{ "printWidth": ${narrow}, }`, 'oxfmt.config.ts': typedWide },
    title: ".oxfmtrc.json comes first in oxfmt's order, a trailing comma allowed",
  },
  {
    expected: jsonc,
    files: {
      '.oxfmtrc.jsonc': `{\n  "$schema": "https://oxc.rs/schema.json", // url\n  /* width */ "printWidth": ${jsonc}, // trailing\n}\n`,
    },
    title: 'JSONC strips comments, never a // inside a string, then trailing commas',
  },
  { expected: wide, files: { 'oxfmt.config.ts': typedWide }, title: 'a TS config is required' },
])('$title', async ({ expected, files }) => {
  const built = await within(files);
  expect(built.rules?.['comments/divider']).toStrictEqual(['error', { width: expected }]);
});

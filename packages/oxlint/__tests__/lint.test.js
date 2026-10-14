import { afterAll, expect, test } from 'bun:test';
import { spawnOxlint, write } from './_helpers.js';

const { mkdtempSync, rmSync } = process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');
const { join } = process.getBuiltinModule('node:path');

const consumerOverride = {
  files: ['**/*.tsx'],
  rules: {
    'import/no-default-export': 'error',
    'unicorn/filename-case': ['error', { case: 'pascalCase' }],
  },
};

// every comment ESLint or oxlint reads as configuration, after look-alikes that are not;
// a line `oxlint-disable` covers only what follows it, so last
const banned = [
  '// eslint-disable-next-line no-console',
  '// oxlint-enable',
  '// eslint-env node',
  '// oxlint-disable-line no-console',
  '/* eslint no-console: "off" */',
  '/* global foo */',
  '/* globals foo */',
  '/* exported bar */',
  '// oxlint-disable',
];
const directives = [
  '// global foo',
  '// eslint-disabled',
  '/* exportedx */',
  'export const value = 1;',
  ...banned,
  '',
].join('\n');

const index = Bun.fileURLToPath(import.meta.resolve('../index.js'));

// no package.json above the temp dir: every environment is on
const directory = mkdtempSync(join(tmpdir(), 'oxlint-lint-'));
afterAll(() => {
  rmSync(directory, { force: true, recursive: true });
});
write(directory, {
  'app/api/route.ts': [
    'export function GET() {',
    '  return 1;',
    '}',
    '',
    'export function POST() {',
    '  return 2;',
    '}',
    '',
  ].join('\n'),
  'app/page.tsx': 'export default function Page() {\n  return null;\n}\n',
  'blanket.js': '/* oxlint-disable */\nexport const value = 1;\n',
  'described.js': '/* eslint-disable -- reason */\nexport const value = 1;\n',
  'directives.js': directives,
  'instrumentation.ts': [
    'export async function register(): Promise<void> {',
    "  globalThis.console.info('registered');",
    '}',
    '',
  ].join('\n'),
  'next.config.js': 'export const extra = 1;\nexport default {};\n',
  'own-line.js': 'export const value = 1; // oxlint-disable-line inline-config/no-directives\n',
  'oxlint.config.mjs': `import { defineConfig } from ${JSON.stringify(index)};\nexport default defineConfig({ overrides: [${JSON.stringify(consumerOverride)}] });\n`,
  'oxlint.config.ts': 'export const extra = 1;\nexport default {};\n',
  'src/later.ts': 'export async function later(): Promise<number> {\n  return 1;\n}\n',
  'src/plain.js': [
    "const fs = require('node:fs');",
    'process = fs;',
    'const _unused = 1;',
    'export const mask = 0xff;',
    '',
  ].join('\n'),
  'sub/next.config.js': 'export const extra = 1;\nexport default {};\n',
});

/**
@param {string[]} paths
@returns {{ exitCode: number; output: string; report: { diagnostics: { code: string; filename: string; labels: [{ span: { length: number; offset: number } }] }[] } }}
*/
const lint = (paths) =>
  spawnOxlint(directory, ['-c', 'oxlint.config.mjs', '--format', 'json', ...paths]);

const {
  report: { diagnostics },
} = lint([
  'app',
  'directives.js',
  'instrumentation.ts',
  'next.config.js',
  'oxlint.config.ts',
  'src',
  'sub',
]);
/** @param {string} file */
const codes = (file) =>
  diagnostics.filter(({ filename }) => filename === file).map(({ code }) => code);

// the negative assertions below hold vacuously for a file never linted
test('every fixture was linted', () => {
  expect([...new Set(diagnostics.map(({ filename }) => filename))].toSorted()).toEqual([
    'app/api/route.ts',
    'app/page.tsx',
    'directives.js',
    'instrumentation.ts',
    'next.config.js',
    'oxlint.config.ts',
    'src/later.ts',
    'src/plain.js',
    'sub/next.config.js',
  ]);
});

test('every directive form is banned, and nothing else', () => {
  expect(
    diagnostics
      .filter(
        ({ code, filename }) =>
          filename === 'directives.js' && code === 'inline-config(no-directives)',
      )
      .map(({ labels }) => labels[0].span)
      .map(({ length, offset }) => directives.slice(offset, offset + length)),
  ).toEqual(banned);
});

test('Node globals are declared (globals.node)', () => {
  expect(codes('src/plain.js')).toContain('eslint(no-global-assign)');
});

test("no-unused-vars has ESLint's defaults: no `^_` ignore pattern", () => {
  expect(codes('src/plain.js')).toContain('eslint(no-unused-vars)');
});

test('typescript/* rules stay off JavaScript files', () => {
  expect(codes('src/plain.js').filter((code) => code.startsWith('typescript('))).toEqual([]);
});

test('rules eslint-config-prettier switched off stay off', () => {
  expect(codes('src/plain.js')).not.toContain('unicorn(number-literal-case)');
});

test('TS files run the typed require-await only; instrumentation runs neither', () => {
  expect(codes('src/later.ts')).not.toContain('eslint(require-await)');
  expect(codes('instrumentation.ts')).not.toContain('eslint(require-await)');
});

test('Next route handlers may be separate named exports', () => {
  expect(codes('app/api/route.ts')).not.toContain('import(group-exports)');
});

test('root tooling configs export only a default; nested ones are app code', () => {
  expect(codes('next.config.js')).toContain('import(no-named-export)');
  expect(codes('next.config.js')).not.toContain('import(no-default-export)');
  expect(codes('oxlint.config.ts')).toContain('import(no-named-export)');
  expect(codes('sub/next.config.js')).toContain('import(no-default-export)');
});

// the consumer's overrides come last, so they beat the base's Next exemptions
test('a consumer `**/*.tsx` override beats the base Next overrides', () => {
  expect(codes('app/page.tsx')).toContain('import(no-default-export)');
  expect(codes('app/page.tsx')).toContain('unicorn(filename-case)');
});

test.each(['blanket.js', 'described.js', 'own-line.js'])(
  'a directive that would suppress its own ban fails the run: %s',
  (file) => {
    const { exitCode, output } = lint([file]);
    expect(exitCode).not.toBe(0);
    expect(output).toContain('would suppress its own report');
  },
);

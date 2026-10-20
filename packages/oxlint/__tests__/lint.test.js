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

const index = join(import.meta.dirname, '..', 'index.js');

// no package.json above the temp dir: every environment is on
const directory = mkdtempSync(join(tmpdir(), 'oxlint-lint-'));
afterAll(() => {
  rmSync(directory, { force: true, recursive: true });
});
write(directory, {
  'app/api/route.ts':
    'export function GET() {\n  return 1;\n}\n\nexport function POST() {\n  return 2;\n}\n',
  'app/page.tsx': 'export default function Page() {\n  return null;\n}\n',
  'blanket.js': '/* oxlint-disable */\nexport const value = 1;\n',
  'described.js': '/* eslint-disable -- reason */\nexport const value = 1;\n',
  'directives.js': directives,
  'instrumentation.js': 'export async function register() {\n  return 1;\n}\n',
  'next.config.js': 'export const extra = 1;\nexport default {};\n',
  'own-line.js': 'export const value = 1; // oxlint-disable-line inline-config/no-directives\n',
  'oxlint.config.mjs': `import { defineConfig } from ${JSON.stringify(index)};\nexport default defineConfig({ overrides: [${JSON.stringify(consumerOverride)}] });\n`,
  'oxlint.config.ts': 'export const extra = 1;\nexport default {};\n',
  'src/later.ts': 'export async function later(): Promise<number> {\n  return 1;\n}\n',
  'src/plain.js': "const fs = require('node:fs');\nprocess = fs;\nconst _unused = 1;\n",
  'sub/next.config.js': 'export const extra = 1;\nexport default {};\n',
});

/**
@param {string[]} paths
@returns {{ exitCode: number; output: string; report: { diagnostics: { code: string; filename: string; labels: [{ span: { length: number; offset: number } }] }[] } }}
*/
const lint = (paths) => spawnOxlint(directory, ['-c', 'oxlint.config.mjs', ...paths]);

/** per linted file, whether each code (or code prefix) reports there; each file must report something, so no negative holds vacuously */
const expected = {
  // Next route handlers may be separate named exports
  'app/api/route.ts': { 'import(group-exports)': false },
  // a consumer `**/*.tsx` override comes last, so it beats the base's Next exemptions
  'app/page.tsx': { 'import(no-default-export)': true, 'unicorn(filename-case)': true },
  'directives.js': {},
  // Next's register() may be async without awaiting
  'instrumentation.js': { 'eslint(require-await)': false },
  // root tooling configs export only a default; nested ones are app code
  'next.config.js': { 'import(no-default-export)': false, 'import(no-named-export)': true },
  'oxlint.config.ts': { 'import(no-named-export)': true },
  // TS files run the typed require-await only
  'src/later.ts': { 'eslint(require-await)': false },
  'src/plain.js': {
    // Node globals are declared (globals.node)
    'eslint(no-global-assign)': true,
    // ESLint's defaults: no `^_` ignore pattern
    'eslint(no-unused-vars)': true,
    // TypeScript rules stay off JavaScript files
    'typescript(': false,
  },
  'sub/next.config.js': { 'import(no-default-export)': true },
};

const {
  report: { diagnostics },
} = lint(Object.keys(expected));

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

test.each(Object.entries(expected))('%s', (file, want) => {
  const found = diagnostics.filter(({ filename }) => filename === file).map(({ code }) => code);
  expect(found).not.toEqual([]);
  expect(
    Object.fromEntries(
      Object.keys(want).map((code) => [code, found.some((each) => each.startsWith(code))]),
    ),
  ).toEqual(want);
});

test.each(['blanket.js', 'described.js', 'own-line.js'])(
  'a directive that would suppress its own ban fails the run: %s',
  (file) => {
    const { exitCode, output } = lint([file]);
    expect(exitCode).not.toBe(0);
    expect(output).toContain('would suppress its own report');
  },
);

test('a run oxlint cannot report on throws with its output', () => {
  expect(() => spawnOxlint(directory, ['-c', 'missing.json'])).toThrow(
    'Failed to parse oxlint configuration file',
  );
});

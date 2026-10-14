import { afterAll, expect, test } from 'bun:test';
import { oxlintBin } from './_helpers.js';

const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } =
  process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');
const { dirname, join } = process.getBuiltinModule('node:path');

const consumerOverride = {
  files: ['**/*.tsx'],
  rules: {
    'import/no-default-export': 'error',
    'unicorn/filename-case': ['error', { case: 'pascalCase' }],
  },
};

// no package.json above the temp dir: every environment is on
const entry = {
  file: 'oxlint.config.mjs',
  source: `import { defineConfig } from ${JSON.stringify(Bun.fileURLToPath(import.meta.resolve('../index.js')))};\nexport default defineConfig({ overrides: [${JSON.stringify(consumerOverride)}] });\n`,
};

const fixtures = {
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
  'instrumentation.ts': [
    'export async function register(): Promise<void> {',
    "  globalThis.console.info('registered');",
    '}',
    '',
  ].join('\n'),
  'next.config.js': 'export const extra = 1;\nexport default {};\n',
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
};

/** @type {string[]} */
const directories = [];
afterAll(() => {
  for (const directory of directories) {
    rmSync(directory, { force: true, recursive: true });
  }
});

/**
 * @param {string[]} paths
 * @returns {{ diagnostics: { code: string; filename: string }[]; exitCode: number; output: string }}
 */
const lint = (paths) => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-parity-'));
  directories.push(directory);
  for (const [name, source] of Object.entries({ ...fixtures, [entry.file]: entry.source })) {
    mkdirSync(dirname(join(directory, name)), { recursive: true });
    writeFileSync(join(directory, name), source);
  }
  const out = join(directory, 'report.json');
  const { exitCode, stderr } = Bun.spawnSync(
    [process.execPath, oxlintBin, '-c', entry.file, '--format', 'json', ...paths],
    { cwd: directory, stderr: 'pipe', stdout: Bun.file(out) },
  );
  const text = String(readFileSync(out));
  return {
    diagnostics: text.trim().startsWith('{') ? JSON.parse(text).diagnostics : [],
    exitCode,
    output: `${text}${stderr}`,
  };
};

const { diagnostics } = lint([
  'app',
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
    'instrumentation.ts',
    'next.config.js',
    'oxlint.config.ts',
    'src/later.ts',
    'src/plain.js',
    'sub/next.config.js',
  ]);
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

test('a directive that would suppress its own ban fails the run', () => {
  const { exitCode, output } = lint(['blanket.js']);
  expect(exitCode).not.toBe(0);
  expect(output).toContain('would suppress its own report');
});

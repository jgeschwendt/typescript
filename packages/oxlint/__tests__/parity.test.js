import { afterAll, describe, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { oxlintBin } from './_helpers.js';

// Behaviors of @jlg/eslint the base restores through config rather than a
// rule, linted end to end from the checkout through both entries. Each was
// lost once without anything failing (migration audit, 2026-10-09).

const here = import.meta.dirname;
const consumerOverride = {
  files: ['**/*.tsx'],
  rules: {
    'import/no-default-export': 'error',
    'unicorn/filename-case': ['error', { case: 'pascalCase' }],
  },
};

const entries = {
  js: {
    file: 'oxlint.config.mjs',
    source: `import { defineConfig } from ${JSON.stringify(join(here, '..', 'index.mjs'))};\nexport default defineConfig({ overrides: [${JSON.stringify(consumerOverride)}] });\n`,
  },
  json: {
    file: '.oxlintrc.json',
    source: JSON.stringify({
      extends: [join(here, '..', 'oxlintrc.jsonc')],
      overrides: [consumerOverride],
    }),
  },
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
  'src/later.ts':
    'export async function later(): Promise<number> {\n  return 1;\n}\n',
  'src/plain.js': [
    "const fs = require('node:fs');",
    'process = fs;',
    'const _unused = 1;',
    'export const mask = 0xff;',
    '',
  ].join('\n'),
  'sub/next.config.js': 'export const extra = 1;\nexport default {};\n',
};

const directories = [];
afterAll(() => {
  for (const directory of directories) {
    rmSync(directory, { force: true, recursive: true });
  }
});

const lint = (entry, paths) => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-parity-'));
  directories.push(directory);
  for (const [name, source] of Object.entries({
    ...fixtures,
    [entry.file]: entry.source,
  })) {
    mkdirSync(dirname(join(directory, name)), { recursive: true });
    writeFileSync(join(directory, name), source);
  }
  const out = join(directory, 'report.json');
  const result = Bun.spawnSync(
    [
      process.execPath,
      oxlintBin,
      '-c',
      entry.file,
      '--format',
      'json',
      ...paths,
    ],
    { cwd: directory, stderr: 'pipe', stdout: Bun.file(out) },
  );
  return {
    diagnostics: (() => {
      const text = readFileSync(out, 'utf8');
      return text.trim().startsWith('{') ? JSON.parse(text).diagnostics : [];
    })(),
    exitCode: result.exitCode,
    output: `${readFileSync(out, 'utf8')}${result.stderr.toString()}`,
  };
};

// `file → codes` for the reported diagnostics
const byFile = (diagnostics) => {
  const files = {};
  for (const { code, filename } of diagnostics) {
    (files[filename] ??= new Set()).add(code);
  }
  return files;
};

describe.each(Object.keys(entries))('through the %s entry', (kind) => {
  const files = byFile(
    lint(entries[kind], [
      'app',
      'instrumentation.ts',
      'next.config.js',
      'oxlint.config.ts',
      'src',
      'sub',
    ]).diagnostics,
  );
  const codes = (file) => [...(files[file] ?? [])];

  // the negative assertions below hold vacuously for a file never linted
  test('every fixture was linted', () => {
    expect(Object.keys(files).toSorted()).toEqual([
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
    expect(
      codes('src/plain.js').filter((code) => code.startsWith('typescript(')),
    ).toEqual([]);
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

  // defineConfig re-appends the file-named base overrides after the
  // consumer's; an `extends` of the JSONC cannot, so there the consumer wins
  test.if(kind === 'js')(
    'base Next overrides beat a consumer `**/*.tsx` override',
    () => {
      expect(codes('app/page.tsx')).not.toContain('import(no-default-export)');
      expect(codes('app/page.tsx')).not.toContain('unicorn(filename-case)');
    },
  );

  test.if(kind === 'json')(
    'a consumer `**/*.tsx` override beats the base Next overrides',
    () => {
      expect(codes('app/page.tsx')).toContain('import(no-default-export)');
    },
  );
});

test('a directive that would suppress its own ban fails the run', () => {
  const { exitCode, output } = lint(entries.json, ['blanket.js']);
  expect(exitCode).not.toBe(0);
  expect(output).toContain('would suppress its own report');
});

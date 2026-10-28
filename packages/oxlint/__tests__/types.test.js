import { expect, test } from 'bun:test';
import { config, overrides, scratch, spawnOxlint, write } from './_helpers.js';

const { readFileSync } = process.getBuiltinModule('node:fs');
const { join } = process.getBuiltinModule('node:path');

const key = 'types/prefer-readonly-generic';
const generic = 'A readonly object type is `Readonly<{ … }>`, not per-member `readonly`.';
const mixed =
  'Only some members are `readonly`: wrap the whole literal in `Readonly<{ … }>` or split the type.';
const redundant = '`readonly` is redundant inside `Readonly<{ … }>`.';

/** per file: its source, the rule's messages on it, and its text once every fix settles */
const cases = {
  'generic.ts': [
    'export type Bag = Set<{ readonly a: string; readonly [key: string]: string }>;\n',
    [generic, generic],
    'export type Bag = Set<Readonly<{ a: string; [key: string]: string }>>;\n',
  ],
  'mixed.ts': [
    'export type Bag = Set<{ readonly a: string; readonly b: string; c: string }>;\n',
    [mixed, mixed],
  ],
  'nested.ts': [
    'export type Bag = Set<{ readonly a: { readonly b: string } }>;\n',
    [generic, generic],
    'export type Bag = Set<Readonly<{ a: Readonly<{ b: string }> }>>;\n',
  ],
  'out-of-scope.ts': [
    'export interface Box {\n  readonly a: string;\n}\nexport type List = Set<readonly [string, string]>;\nexport type Names = readonly string[];\n',
    [],
  ],
  'redundant.ts': [
    'export type Bag = Set<Readonly<{ readonly a: string; b: string }>>;\n',
    [redundant],
    'export type Bag = Set<Readonly<{ a: string; b: string }>>;\n',
  ],
};

// no package.json above the temp dir: every environment is on
const directory = scratch('oxlint-types-');
write(directory, {
  ...Object.fromEntries(Object.entries(cases).map(([file, [source]]) => [file, source])),
  'oxlint.config.mjs': `import { defineConfig } from ${JSON.stringify(join(import.meta.dirname, '..', 'index.js'))};\nexport default defineConfig();\n`,
});

/** @type {{ diagnostics: { code: string; filename: string; message: string }[] }} */
const { diagnostics } = spawnOxlint(directory, ['-c', 'oxlint.config.mjs', ...Object.keys(cases)]);
spawnOxlint(directory, ['-c', 'oxlint.config.mjs', '--fix', ...Object.keys(cases)]);

test.each(Object.entries(cases))('%s', (file, [source, messages, fixed = source]) => {
  expect(
    diagnostics
      .filter(
        ({ code, filename }) => filename === file && code === 'types(prefer-readonly-generic)',
      )
      .map(({ message }) => message),
  ).toEqual(messages);
  const text = String(readFileSync(join(directory, file)));
  expect(text).toBe(fixed);
});

test('the rule runs on TypeScript files only', () => {
  expect(Object.hasOwn(config.rules ?? {}, key)).toBe(false);
  expect(
    overrides.filter(({ rules = {} }) => Object.hasOwn(rules, key)).map(({ files }) => files),
  ).toEqual([['**/*.{cts,mts,ts,tsx}']]);
});

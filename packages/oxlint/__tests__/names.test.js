import { expect, test } from 'bun:test';
import { scratch, spawnOxlint, write } from './_helpers.js';

const { join } = process.getBuiltinModule('node:path');

/**
per file: its source and the rule's messages on it, in source order
@type {Record<string, [string, string[]]>}
*/
const cases = {
  'allow.ts': [
    'export const $_raw = 1;\nexport const api_key = 2;\nexport const not_api_key = 3;\n',
    ['The variable `not_api_key` is not camelCase or UPPER_CASE.'],
  ],
  'app/route.js': [
    'export function GET() {}\nexport function Fetch() {}\nfunction POST() {}\n',
    ['The function `Fetch` is not camelCase.', 'The function `POST` is not camelCase.'],
  ],
  'default.ts': [
    [
      "import Default_x from 'm';",
      "import * as space from 'm';",
      "import { kept_name, other as renamed_x } from 'm';",
      'const MAX_SIZE = 1;',
      'const { a_b, ...REST_ } = space;',
      'const [, first_x = 1] = [kept_name];',
      'class widget<item> {',
      '  #secret_x = 1;',
      "  ['computed_x'] = 2;",
      "  'needs-quotes' = 3;",
      '  constructor(private readonly own_x: number, _unused: number, _: number, __: number, __x: number) {}',
      '}',
      'const anonymous = class {};',
      "enum Color { Red, green, 'a-b' }",
      'interface shape { size_x: number; on_change: () => void; run_x(): void }',
      'type pair = { left: number };',
      'const value = { Pascal: 1, snake_x: 2, method_x() {}, get getter_x() { return 1; }, 1: 3, [MAX_SIZE]: 4, Method() {} };',
      'export function GET(param_x) {}',
      'const arrow = (Arg) => Arg;',
      '',
    ].join('\n'),
    [
      'The import `Default_x` is not camelCase.',
      'The import `renamed_x` is not camelCase.',
      'The variable `a_b` is not camelCase or UPPER_CASE.',
      'The variable `REST_` is not camelCase or UPPER_CASE.',
      'The variable `first_x` is not camelCase or UPPER_CASE.',
      'The class `widget` is not PascalCase.',
      'The typeParameter `item` is not PascalCase.',
      'The classMember `secret_x` is not camelCase.',
      'The parameterProperty `own_x` is not camelCase.',
      'The parameter `__x` is not camelCase.',
      'The enumMember `green` is not PascalCase.',
      'The interface `shape` is not PascalCase.',
      'The typeProperty `size_x` is not camelCase.',
      'The typeMethod `on_change` is not camelCase.',
      'The typeMethod `run_x` is not camelCase.',
      'The typeAlias `pair` is not PascalCase.',
      'The objectLiteralProperty `snake_x` is not camelCase or PascalCase.',
      'The objectLiteralMethod `method_x` is not camelCase.',
      'The accessor `getter_x` is not camelCase.',
      'The objectLiteralMethod `Method` is not camelCase.',
      'The function `GET` is not camelCase.',
      'The parameter `param_x` is not camelCase.',
      'The parameter `Arg` is not camelCase.',
    ],
  ],
  'widget.tsx': [
    [
      "import Component from 'm';",
      'type Props = { OnClick: number };',
      'export function Button(Props_x: Props) {}',
      'const Theme = { Primary: Component, Render() {} };',
      'const snake_case = Theme;',
      '',
    ].join('\n'),
    [
      'The parameter `Props_x` is not camelCase.',
      'The variable `snake_case` is not camelCase or PascalCase or UPPER_CASE.',
    ],
  ],
};

const allow = {
  files: ['allow.ts'],
  rules: { 'names/case': ['error', { allow: ['$_raw', String.raw`api_\w+`] }] },
};

// no package.json above the temp dir: every environment is on
const directory = scratch('oxlint-names-');
write(directory, {
  ...Object.fromEntries(Object.entries(cases).map(([file, [source]]) => [file, source])),
  'oxlint.config.mjs': `import { defineConfig } from ${JSON.stringify(join(import.meta.dirname, '..', 'index.js'))};\nexport default defineConfig({ overrides: [${JSON.stringify(allow)}] });\n`,
});

/** @type {{ diagnostics: { code: string; filename: string; message: string }[] }} */
const { diagnostics } = spawnOxlint(directory, ['-c', 'oxlint.config.mjs', ...Object.keys(cases)]);

test.each(Object.entries(cases))('%s', (file, [, messages]) => {
  expect(
    diagnostics
      .filter(({ code, filename }) => filename === file && code === 'names(case)')
      .map(({ message }) => message),
  ).toEqual(messages);
});

import { expect, test } from 'bun:test';
import { scratch, spawnOxlint, write } from './_helpers.js';

const { readFileSync } = process.getBuiltinModule('node:fs');
const { join } = process.getBuiltinModule('node:path');

const printWidth = 100;
const narrowWidth = 40;
const narrow = {
  files: ['narrow/*.js'],
  rules: { 'comments/divider': ['error', { width: narrowWidth }] },
};
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
  '/* oxlint-enable */',
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

/**
a divider `width` columns wide
@param {string} head
@param {number} width
*/
const pad = (head, width) => head.padEnd(width, '─');
const trailing = 'export const value = 1; // ─── trailing ';
const long = `// ─── ${'x'.repeat(printWidth)} ─`;
// the four dividers, then two comments that are none
const dividers = [
  pad('// ─── fits ', printWidth),
  '// ─── short ───',
  `${trailing}───`,
  long,
  '/* ─── block ─── */',
  '// prose ───',
  '',
].join('\n');

const fromFs = " from 'node:fs';\n";
const read = "export const read = (path: PathLike): string => readFileSync(path, 'utf8');\n";
const alias = 'export type Path = PathLike;\n';
const duplicates = ['eslint(no-duplicate-imports)', 'import(no-duplicates)'];
const maxJsxDepth = 7;
/** @param {number} depth JSX nested `depth` below its root */
const tree = (depth) =>
  `export const tree = ${'<i>'.repeat(depth + 1)}${'</i>'.repeat(depth + 1)};\n`;
const maxStatements = 10;
/** a function body one statement over max-statements' default */
const statements = `  let total = 0;\n${'  total += 1;\n'.repeat(maxStatements - 1)}  return total;\n`;
/** per file: its source and the rules under test it reports, sorted @type {Record<string, [string, string[]]>} */
const targeted = {
  'app/blog/[slug]/page.tsx': [
    "type PageProps = Readonly<{ params: Promise<{ slug: string }>; searchParams: Promise<object> }>;\nexport const generateStaticParams = (): { slug: string }[] => [{ slug: 'a' }];\nexport default async function Page({ params, searchParams }: PageProps): Promise<string> {\n  const [{ slug }] = await Promise.all([params, searchParams]);\n  return slug;\n}\n",
    [],
  ],
  'imports/inline-sorted.ts': [`import { type PathLike, readFileSync }${fromFs}${read}`, []],
  'imports/inline-unsorted.ts': [
    `import { readFileSync, type PathLike }${fromFs}${read}`,
    ['eslint(sort-imports)'],
  ],
  'imports/split.ts': [
    `import { readFileSync }${fromFs}import type { PathLike }${fromFs}${read}`,
    duplicates,
  ],
  'imports/two-values.ts': [
    `import { readFileSync }${fromFs}import { writeFileSync }${fromFs}export const both = [readFileSync, writeFileSync];\n`,
    duplicates,
  ],
  'imports/type-inline.ts': [
    `import { type PathLike }${fromFs}${alias}`,
    ['typescript(no-import-type-side-effects)'],
  ],
  'imports/type-only.ts': [`import type { PathLike }${fromFs}${alias}`, []],
  'imports/value-of-type.ts': [
    `import { PathLike, readFileSync }${fromFs}${read}`,
    ['typescript(consistent-type-imports)'],
  ],
  'jsx/depth-7.tsx': [tree(maxJsxDepth), []],
  'jsx/depth-8.tsx': [tree(maxJsxDepth + 1), ['react(jsx-max-depth)']],
  // a lone top-level function is exempt; one nested inside it is not
  'max-statements/nested.ts': [
    `export const outer = (): number => {\n  const inner = (): number => {\n${statements}  };\n  return inner();\n};\n`,
    ['eslint(max-statements)'],
  ],
  'max-statements/top-level.ts': [`export const top = (): number => {\n${statements}};\n`, []],
  'react/button.tsx': [
    'import { type Ref, useRef } from \'react\';\n\ntype ButtonProps = Readonly<{ label: string; ref: Ref<HTMLButtonElement> }>;\nexport const Button = ({ label, ref }: ButtonProps): React.JSX.Element => {\n  const inputRef = useRef<HTMLInputElement>(null);\n  return (\n    <button ref={ref} type="button">\n      {label}\n      <input ref={inputRef} />\n    </button>\n  );\n};\n',
    [],
  ],
  'react/card-props.ts': [
    'export type CardProps = Readonly<{ title: string }>;\nexport const render = (props: CardProps): string => props.title;\n',
    [],
  ],
  // the rule still runs: only React's and Next's words are cleared
  'react/options.ts': ['export const opts = 1;\n', ['unicorn-js(name-replacements)']],
};

// no package.json above the temp dir: every environment is on
const directory = scratch('oxlint-lint-');
write(directory, {
  ...Object.fromEntries(Object.entries(targeted).map(([file, [source]]) => [file, source])),
  'app/api/route.ts':
    'export function GET() {\n  return 1;\n}\n\nexport function POST() {\n  return 2;\n}\n',
  'app/opengraph-image.ts':
    "export const alt = 'About';\nexport const size = { height: 630, width: 1200 };\n\nexport default function Image() {\n  return null;\n}\n",
  'app/page.tsx': 'export default function Page() {\n  return null;\n}\n',
  'described.js': '/* oxlint-disable -- reason */\nexport const value = 1;\n',
  'directives.js': directives,
  'dividers.js': dividers,
  'instrumentation.js': 'export async function register() {\n  return 1;\n}\n',
  'narrow/dividers.js': dividers,
  'next.config.js': 'export const extra = 1;\nexport default {};\n',
  'own-line.js':
    'export const value = 1; // oxlint-disable-line no-console,inline-config/no-directives\n',
  'oxlint.config.mjs': `import { defineConfig } from ${JSON.stringify(join(import.meta.dirname, '..', 'index.js'))};\nexport default defineConfig({ overrides: [${JSON.stringify(consumerOverride)}, ${JSON.stringify(narrow)}] });\n`,
  'oxlint.config.ts': 'export const extra = 1;\nexport default {};\n',
  'proxy.ts':
    "export const config = { matcher: '/about' };\n\nexport function proxy() {\n  return 1;\n}\n",
  'src/later.ts': 'export async function later(): Promise<number> {\n  return 1;\n}\n',
  'src/plain.js': "const fs = require('node:fs');\nprocess = fs;\nconst _unused = 1;\n",
  'sub/next.config.js': 'export const extra = 1;\nexport default {};\n',
});

/** per linted file, whether each code (or code prefix) reports there; each file must report something, so no negative holds vacuously */
const expected = {
  // Next route handlers may be separate named exports
  'app/api/route.ts': { 'import(group-exports)': false },
  // an image convention default-exports the image beside its alt and size
  'app/opengraph-image.ts': { 'import(group-exports)': false, 'import(no-default-export)': false },
  // a consumer `**/*.tsx` override comes last, so it beats the base's Next exemptions
  'app/page.tsx': { 'import(no-default-export)': true, 'unicorn(filename-case)': true },
  'directives.js': {},
  // Next's register() may be async without awaiting
  'instrumentation.js': { 'eslint(require-await)': false },
  // root tooling configs export only a default; nested ones are app code
  'next.config.js': { 'import(no-default-export)': false, 'import(no-named-export)': true },
  'oxlint.config.ts': { 'import(no-named-export)': true },
  // Next 16's proxy exports its config beside the function
  'proxy.ts': { 'import(group-exports)': false },
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

const suppressing = ['described.js', 'own-line.js'];
/** @type {[string, string]} */
const divided = ['dividers.js', 'narrow/dividers.js'];

/** @type {{ diagnostics: { code: string; filename: string; labels: [{ span: { length: number; offset: number } }]; message: string; severity: string }[] }} */
const { diagnostics } = spawnOxlint(directory, [
  '-c',
  'oxlint.config.mjs',
  ...Object.keys(expected),
  ...Object.keys(targeted),
  ...suppressing,
  ...divided,
]);

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

test.each(suppressing)('a directive that would suppress its own ban fails the run: %s', (file) =>
  expect(diagnostics.filter(({ filename }) => filename === file)).toContainEqual(
    expect.objectContaining({
      message: expect.stringContaining(
        `${file}:1 carries a directive that would suppress its own report`,
      ),
      severity: 'error',
    }),
  ),
);

test('a run oxlint cannot report on throws with its output', () => {
  expect(() => spawnOxlint(directory, ['-c', 'missing.json'])).toThrow(
    'Failed to parse oxlint configuration file',
  );
});

/** @param {number} width */
const ends = (width) => `A divider ends at column ${width}.`;
/** @param {number} width */
const tooLong = (width) => `Divider title too long for ${width} columns.`;
test.each([
  [
    divided[0],
    [ends(printWidth), ends(printWidth), tooLong(printWidth)],
    ['// ─── fits ', '// ─── short ', trailing].map((head) => pad(head, printWidth)),
  ],
  [
    divided[1],
    [ends(narrowWidth), ends(narrowWidth), tooLong(narrowWidth), tooLong(narrowWidth)],
    [pad('// ─── fits ', narrowWidth), pad('// ─── short ', narrowWidth), `${trailing}───`],
  ],
])('a divider ends at the width, fixed by its run of rules: %s', (file, messages, fixed) => {
  expect(
    diagnostics
      .filter(({ code, filename }) => filename === file && code === 'comments(divider)')
      .map(({ message }) => message),
  ).toEqual(messages);
  // other rules fix the lines after the dividers
  spawnOxlint(directory, ['-c', 'oxlint.config.mjs', '--fix', file]);
  const lines = String(readFileSync(join(directory, file))).split('\n');
  expect(lines.slice(0, lines.indexOf(long) + 1)).toEqual([...fixed, long]);
});

// only the rules under test: the fixtures trip unrelated ones (import/no-nodejs-modules among them)
const targetRules = new Set(Object.values(targeted).flatMap(([, codes]) => codes));
test("one import statement per module, a type-only name inline; JSX at most 7 deep; React's and Next's names are no abbreviations; a lone top-level function has no statement ceiling", () => {
  expect(
    Object.fromEntries(
      Object.keys(targeted).map((file) => [
        file,
        [
          ...new Set(
            diagnostics
              .filter(({ code, filename }) => filename === file && targetRules.has(code))
              .map(({ code }) => code),
          ),
        ].toSorted(),
      ]),
    ),
  ).toEqual(Object.fromEntries(Object.entries(targeted).map(([file, [, codes]]) => [file, codes])));
  // the first pass merges, the second sorts the members; oxfmt, not run here, spaces the merged comma
  const fixed = ['imports/split.ts', 'imports/value-of-type.ts'];
  spawnOxlint(directory, ['-c', 'oxlint.config.mjs', '--fix', ...fixed]);
  spawnOxlint(directory, ['-c', 'oxlint.config.mjs', '--fix', ...fixed]);
  expect(
    fixed.map((file) =>
      String(readFileSync(join(directory, file)))
        .replaceAll(/, */gu, ', ')
        .split('\n', 1),
    ),
  ).toEqual(fixed.map(() => ["import { type PathLike, readFileSync } from 'node:fs';"]));
});

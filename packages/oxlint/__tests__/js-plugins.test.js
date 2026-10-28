import { beforeAll, expect, test } from 'bun:test';
import { ruleNames, scratch, spawnOxlint, write } from './_helpers.js';

const { join } = process.getBuiltinModule('node:path');

const { default: typescript } = await import(
  join(import.meta.dirname, '..', 'plugins', 'typescript-js.js')
);

test('typescript-js/naming-convention refuses the typed `types` option', () => {
  expect(() =>
    typescript.rules['naming-convention'].create({
      options: [{ types: ['boolean'] }],
      sourceCode: {},
    }),
  ).toThrow('needs type information');
});

test('a host lists oxlint only the rules a config names', () => {
  expect(Object.keys(typescript.rules).map((name) => `typescript-js/${name}`)).toEqual(
    ruleNames.filter((key) => key.startsWith('typescript-js/')),
  );
  expect(
    ['naming-convention', 'typedef'].map((name) => Reflect.has(typescript.rules, name)),
  ).toEqual([true, false]);
});

/** the rules the fixtures below trip; every other configured one need only load and not crash */
const fixtured = Object.entries({
  comments: 'divider',
  'eslint-js':
    'camelcase consistent-this no-invalid-this no-restricted-syntax no-undef-init require-atomic-updates',
  'import-js':
    'no-deprecated no-extraneous-dependencies no-import-module-exports no-internal-modules no-relative-packages no-restricted-paths no-unresolved no-useless-path-segments',
  'inline-config': 'no-directives',
  'react-js':
    'boolean-prop-naming destructuring-assignment jsx-no-bind jsx-no-leaked-render jsx-sort-props no-adjacent-inline-elements no-deprecated no-invalid-html-attribute no-typos no-unused-prop-types prefer-read-only-props require-default-props',
  types: 'prefer-readonly-generic',
  'typescript-js': 'member-ordering naming-convention no-shadow',
  'unicorn-js':
    'consistent-destructuring consistent-json-file-read expiring-todo-comments name-replacements no-for-loop no-keyword-prefix no-named-default no-unnecessary-polyfills no-unused-properties prefer-switch string-content',
}).flatMap(([scope, names]) => names.split(' ').map((name) => `${scope}(${name})`));

/** rules that check nothing without options */
const inert = {
  'eslint-js/no-restricted-syntax': ['error', 'DebuggerStatement'],
  'import-js/no-restricted-paths': ['error', { zones: [{ from: './packages', target: './src' }] }],
  'react-js/boolean-prop-naming': ['error', { rule: '^is[A-Z]' }],
  'unicorn-js/string-content': ['error', { patterns: { unicorn: '🦄' } }],
};

const fixtures = {
  'node_modules/not-listed/lib/inner.js': 'export default 1;\n',
  'node_modules/not-listed/package.json': { name: 'not-listed', type: 'module', version: '1.0.0' },
  // required by defineConfig for the divider's width, on Node through its type stripping
  'oxfmt.config.ts': 'const width: number = 100;\nexport default { printWidth: width };\n',
  'packages/inner/index.js': 'export default 1;\n',
  'packages/inner/package.json': { name: 'inner', type: 'module', version: '1.0.0' },
  'src/Widget.tsx': [
    "import ReactDOM from 'react-dom';",
    '',
    'type Props = {',
    '  readonly enabled: boolean;',
    '  readonly label?: string;',
    '  readonly unused: string;',
    '  title: string;',
    '};',
    '',
    'export function Widget(props: Props) {',
    '  const items: string[] = [];',
    '  return (',
    '    <div title={props.title} id="widget">',
    '      {items.length && <span>{props.label}</span>}',
    '      <a href="/x" rel="nonsense">a</a><b>{String(props.enabled)}</b>',
    '      <button onClick={() => items.pop()} type="button">x</button>',
    '    </div>',
    '  );',
    '}',
    '',
    'Widget.PropTypes = {};',
    '',
    'export function Toggle({ enabled }: { readonly enabled: boolean }) {',
    '  return <i>{String(enabled)}</i>;',
    '}',
    '',
    'Toggle.propTypes = { enabled: PropTypes.bool };',
    '',
    'ReactDOM.render(<Widget enabled label="x" title="t" unused="u" />, document.body);',
    '',
    'export class Member {',
    '  public render(): void {}',
    '  private count = 0;',
    '}',
    '',
    'let snake_case = 1;',
    'export { snake_case };',
    '',
  ].join('\n'),
  'src/b.js': [
    '/** @deprecated use fresh */',
    'export const old = 1;',
    'export const fresh = 2;',
    'export default fresh;',
    '',
  ].join('\n'),
  'src/floating.ts':
    'export async function later(): Promise<number> {\n  return 1;\n}\n\nlater();\n',
  'src/legacy.js': [
    '// TODO [2000-01-01]: expired',
    // date conditions skip on pull-request CI (checkDatesOnPullRequests): a version one stays live
    "// TODO [typescript@>=1]: expired by the consumer's typescript@7",
    '// ─── short ───',
    "import inner from 'not-listed/lib/inner.js';",
    "import packaged from '../packages/inner/index.js';",
    "import { default as fresh, old } from './b.js';",
    "import missing from './missing.js';",
    "import sibling from './sub/../b.js';",
    "import fs from 'node:fs';",
    "import assign from 'object-assign';",
    '',
    '// eslint-disable-next-line no-console',
    'let my_var = undefined;',
    'const obj = { a: 1, unused: 2 };',
    "export const json = JSON.parse(fs.readFileSync('./package.json'));",
    "export const str = 'unicorn';",
    'export const newThing = [inner, packaged, fresh, old, missing, sibling, assign, obj.a, my_var];',
    '',
    'export function destructure(foo) {',
    '  const { first } = foo;',
    '  return [first, foo.first];',
    '}',
    '',
    'export function loop(items) {',
    '  for (let index = 0; index < items.length; index++) {',
    '    globalThis.console.log(items[index]);',
    '  }',
    '}',
    '',
    'export function choose(value) {',
    '  if (value === 1) {',
    '    return 1;',
    '  } else if (value === 2) {',
    '    return 2;',
    '  } else if (value === 3) {',
    '    return 3;',
    '  }',
    '  return 0;',
    '}',
    '',
    'export function aliased() {',
    '  const self = this;',
    '  return self;',
    '}',
    '',
    // a Node global: require-atomic-updates needs the base's env.node
    'export async function race(options) {',
    '  options.spec = process.stdin;',
    '  const { code } = await options.run();',
    '  process.exitCode = code;',
    '}',
    '',
    'debugger;',
    '',
    'module.exports = my_var;',
    '',
  ].join('\n'),
  // oxlint evaluates every config before it loads a plugin, so a host lists a rule only a nested config turns on
  'src/nested/oxlint.config.ts': `import { defineConfig } from '@jlg/oxlint';\nexport default defineConfig({ rules: { 'typescript-js/no-shadow': 'error' } });\n`,
  'src/nested/shadow.ts':
    'export const value = 1;\nexport const shadow = (value: number): number => value;\n',
};

// the base arrives as an object: only index.js's absolute paths locate the plugins
const entry = `import { defineConfig } from '@jlg/oxlint';\nexport default defineConfig({ rules: ${JSON.stringify(inert)} });\n`;

// packed and installed under both linkers: only the published files ship, and dependencies resolve from the consumer's tree
const runtimes = { bun: process.execPath, node: Bun.which('node') ?? 'node' };
const linkers = ['hoisted', 'isolated'];
/** ms: a pack plus two installs, or removing them; well past the 5 s hook default under a full-suite run */
const installTimeout = 300_000;
const lintTimeout = 120_000;
const consumers = scratch('oxlint-js-plugins-', installTimeout);
const { peerDependencies } = await Bun.file(join(import.meta.dirname, '..', 'package.json')).json();

/**
a range's floor: the consumer installs the oldest oxlint the base claims, so a newer-only rule name fails here
@param {string} range
*/
const floor = (range) => /\d+\.\d+\.\d+/u.exec(range)?.[0] ?? range;

/**
@param {string[]} command
@param {string} cwd
*/
const run = (command, cwd) => {
  const result = Bun.spawnSync(command, { cwd });
  if (result.exitCode !== 0) {
    throw new Error(`${command.join(' ')} exited ${result.exitCode}: ${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
};

beforeAll(() => {
  const packed = run(
    [process.execPath, 'pm', 'pack', '--destination', consumers, '--quiet'],
    join(import.meta.dirname, '..'),
  );
  for (const linker of linkers) {
    const directory = join(consumers, linker);
    write(directory, {
      'package.json': {
        devDependencies: {
          '@jlg/oxlint': `file:${packed}`,
          oxlint: floor(peerDependencies.oxlint),
          typescript: '7.0.2',
        },
        engines: { node: '>=20' },
        name: 'consumer',
        private: true,
        type: 'module',
      },
    });
    run([process.execPath, 'install', '--linker', linker], directory);
    write(directory, { ...fixtures, 'oxlint.config.ts': entry });
  }
}, installTimeout);

test.each(
  Object.entries(runtimes).flatMap(([name, runtime]) =>
    linkers.map((linker) => [name, linker, runtime]),
  ),
)(
  'on %s, installed %s: no JS-plugin rule crashes, and every fixtured one fires',
  (name, linker, runtime) => {
    const directory = join(consumers, linker);
    const bin = join(directory, 'node_modules', 'oxlint', 'bin', 'oxlint');
    /** @type {{ diagnostics: { code?: string; message: string }[] }} */
    const { diagnostics } = spawnOxlint(directory, ['src'], [runtime, bin]);
    // a crashed plugin drops every JS rule on the file; a crashed rule reports via host.js
    const broken = diagnostics
      .map((diagnostic) => diagnostic.message)
      .filter((message) =>
        /Error running JS plugin|Rule crashed|Parse errors in imported module/u.test(message),
      );
    expect(broken).toEqual([]);
    expect(
      fixtured.filter((code) => diagnostics.every((diagnostic) => diagnostic.code !== code)),
    ).toEqual([]);
    // type-aware through the base's own tsgolint: Node hands oxlint OXLINT_TSGOLINT_PATH, Bun's env never reaches it, so only a hoisted node_modules/.bin/tsgolint serves there
    expect(diagnostics.some(({ code }) => code === 'typescript(no-floating-promises)')).toBe(
      name === 'node' || linker === 'hoisted',
    );
  },
  lintTimeout,
);

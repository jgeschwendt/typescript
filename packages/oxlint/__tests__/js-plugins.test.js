import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { config, isJsRule, jsScopes, ruleNames, spawnOxlint, write } from './_helpers.js';

const { mkdtempSync, readFileSync, rmSync } = process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');
const { join } = process.getBuiltinModule('node:path');

// packed and installed: a consumer's layout (TS 7, isolated deps) is not the checkout's

const plugins = Object.fromEntries(
  await Promise.all(
    (config.jsPlugins ?? []).map(async (entry) => {
      const { default: plugin } = await import(typeof entry === 'string' ? entry : entry.specifier);
      return [typeof entry === 'string' ? plugin.meta.name : entry.name, plugin];
    }),
  ),
);

const configured = ruleNames.filter((name) => isJsRule(name));

test('local plugin names match the scopes the config uses', () => {
  expect(Object.keys(plugins).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
    [...jsScopes].toSorted((left, right) => left.localeCompare(right)),
  );
});

test('every configured jsPlugins rule exists in its plugin', () => {
  const missing = configured.filter((name) => {
    const [scope = '', rule = ''] = name.split('/', 2);
    return plugins[scope]?.rules?.[rule] === undefined;
  });
  expect(
    missing,
    `jsPlugins rule(s) the plugin does not export — oxlint rejects the whole config: ${missing.join(', ')}`,
  ).toEqual([]);
});

/** the rules the fixtures below trip; every other configured one need only load and not crash */
const fixtured = Object.entries({
  'eslint-js':
    'camelcase consistent-this no-invalid-this no-restricted-syntax no-undef-init require-atomic-updates',
  'import-js':
    'no-deprecated no-extraneous-dependencies no-import-module-exports no-internal-modules no-relative-packages no-restricted-paths no-unresolved no-useless-path-segments order',
  'inline-config': 'no-directives',
  'react-js':
    'boolean-prop-naming destructuring-assignment jsx-no-bind jsx-no-leaked-render jsx-sort-props no-adjacent-inline-elements no-deprecated no-invalid-html-attribute no-typos no-unused-prop-types prefer-read-only-props require-default-props',
  'typescript-js': 'member-ordering naming-convention',
  'unicorn-js':
    'consistent-destructuring consistent-json-file-read expiring-todo-comments name-replacements no-for-loop no-keyword-prefix no-named-default no-unnecessary-polyfills no-unused-properties prefer-switch string-content',
}).flatMap(([scope, names]) => names.split(' ').map((name) => `${scope}/${name}`));

/** rules that check nothing without options, as in @jlg/eslint */
const inert = {
  'eslint-js/no-restricted-syntax': ['error', 'DebuggerStatement'],
  'import-js/no-restricted-paths': ['error', { zones: [{ from: './packages', target: './src' }] }],
  'react-js/boolean-prop-naming': ['error', { rule: '^is[A-Z]' }],
  'unicorn-js/string-content': ['error', { patterns: { unicorn: '🦄' } }],
};

const fixtures = {
  'node_modules/not-listed/lib/inner.js': 'export default 1;\n',
  'node_modules/not-listed/package.json': JSON.stringify({
    name: 'not-listed',
    type: 'module',
    version: '1.0.0',
  }),
  'packages/inner/index.js': 'export default 1;\n',
  'packages/inner/package.json': JSON.stringify({
    name: 'inner',
    type: 'module',
    version: '1.0.0',
  }),
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
  'src/legacy.js': [
    '// TODO [2000-01-01]: expired',
    // date conditions skip on pull-request CI (checkDatesOnPullRequests): a version one stays live
    "// TODO [typescript@>=1]: expired by the consumer's typescript@7",
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
};

// the base arrives as an object: only index.js's absolute paths locate the plugins
const entry = `import { defineConfig } from '@jlg/oxlint';\nexport default defineConfig({ rules: ${JSON.stringify(inert)} });\n`;

const runtimes = { bun: process.execPath, node: Bun.which('node') ?? 'node' };
const linkers = ['hoisted', 'isolated'];
const installTimeout = 300_000;
const lintTimeout = 120_000;
const scratch = mkdtempSync(join(tmpdir(), 'oxlint-js-plugins-'));
/** @type {Record<string, string>} */
const consumers = {};

/**
@param {string[]} command
@param {string} cwd
*/
const run = (command, cwd) => {
  const result = Bun.spawnSync(command, {
    cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(`${command.join(' ')} exited ${result.exitCode}: ${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
};

beforeAll(() => {
  const packed = run(
    [process.execPath, 'pm', 'pack', '--destination', scratch, '--quiet'],
    join(import.meta.dirname, '..'),
  );
  const manifest = String(readFileSync(join(import.meta.dirname, '..', 'package.json')));
  const { oxlint } = JSON.parse(manifest).peerDependencies;
  for (const linker of linkers) {
    const directory = join(scratch, linker);
    write(directory, {
      'package.json': JSON.stringify({
        devDependencies: {
          '@jlg/oxlint': `file:${packed.split('\n').pop()}`,
          oxlint,
          typescript: '7.0.2',
        },
        engines: { node: '>=20' },
        name: 'consumer',
        private: true,
        type: 'module',
      }),
    });
    run([process.execPath, 'install', '--linker', linker], directory);
    write(directory, { ...fixtures, 'oxlint.config.ts': entry });
    consumers[linker] = directory;
  }
}, installTimeout);

afterAll(() => {
  rmSync(scratch, { force: true, recursive: true });
});

/**
@param {string} runtime
@param {string} linker
@returns {{ code?: string; message: string }[]}
*/
const lint = (runtime, linker) => {
  const directory = consumers[linker] ?? '';
  const bin = join(directory, 'node_modules', 'oxlint', 'bin', 'oxlint');
  return spawnOxlint(directory, ['--format', 'json', 'src'], [runtime, bin]).report.diagnostics;
};

describe.each(Object.entries(runtimes))('on %s', (_name, runtime) => {
  describe.each(linkers)('installed %s', (linker) => {
    test(
      'no JS-plugin rule crashes, and every fixtured one fires',
      () => {
        const diagnostics = lint(runtime, linker);
        // a crashed plugin drops every JS rule on the file; a crashed rule reports via host.mjs
        const broken = diagnostics
          .map((diagnostic) => diagnostic.message)
          .filter((message) =>
            /Error running JS plugin|Rule crashed|Parse errors in imported module/u.test(message),
          );
        expect(broken).toEqual([]);
        const codes = new Set(
          diagnostics.map((diagnostic) =>
            diagnostic.code?.replace(/^(?<plugin>.+)\((?<rule>.+)\)$/u, '$<plugin>/$<rule>'),
          ),
        );
        expect(fixtured.filter((name) => !codes.has(name))).toEqual([]);
      },
      lintTimeout,
    );
  });
});

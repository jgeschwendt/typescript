import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { configRuleNames, jsPluginScopes, loadConfig } from './_helpers.js';
import { base } from '../index.mjs';

// The jsPlugins layer runs @jlg/eslint's unported rules as ESLint rule code
// (GAPS.md). Failure modes the native-rule guards cannot see:
//
//  1. A configured rule the plugin does not export — oxlint rejects the WHOLE
//     config, so nothing lints.
//  2. A plugin, or a single rule, that loads yet reports nothing.
//     eslint-plugin-unicorn 77 reports nothing at all under oxlint 1.87 (exit
//     0) and 67–76 fail at load (verified 2026-10-08 · bisect); 66 stubs
//     better-regex and prefer-json-parse-buffer as `create: () => ({})`. Hence
//     the 60.0.0 pin and the assertion below that EVERY configured rule fires.
//  3. A layout only an installed copy has. The repo's own node_modules link
//     typescript-eslint to TypeScript 6 and hold every dependency next to the
//     package; a consumer's carries TypeScript 7 and, isolated, holds the
//     dependencies only beside the real path. So the package is packed, the
//     tarball installed under both linkers next to typescript@7, and linted
//     through both entries (the JSONC by its node_modules path, the JS entry by
//     its package name) under both runtimes consumers use (`oxlint` on node,
//     `bun --bun oxlint`). (2026-10-09 · Bun loaded the consumer's TS 7 into
//     typescript-eslint, and an isolated JSONC consumer could not resolve
//     `eslint-plugin-import`; both passed from the checkout)

const plugins = Object.fromEntries(
  await Promise.all(
    base.jsPlugins.map(async (entry) => {
      const { default: plugin } = await import(
        typeof entry === 'string' ? entry : entry.specifier
      );
      return [
        typeof entry === 'string' ? plugin.meta.name : entry.name,
        plugin,
      ];
    }),
  ),
);

const configured = (() => {
  const js = jsPluginScopes(loadConfig());
  return configRuleNames(loadConfig())
    .filter((name) => js.has(name.split('/')[0]))
    .toSorted((left, right) => left.localeCompare(right));
})();

test('local plugin names match the scopes the config uses', () => {
  expect(
    Object.keys(plugins).toSorted((left, right) => left.localeCompare(right)),
  ).toStrictEqual(
    [...jsPluginScopes(loadConfig())].toSorted((left, right) =>
      left.localeCompare(right),
    ),
  );
});

test('every configured jsPlugins rule exists in its plugin', () => {
  const missing = configured.filter((name) => {
    const [scope, rule] = name.split('/');
    return plugins[scope]?.rules?.[rule] === undefined;
  });
  expect(
    missing,
    `jsPlugins rule(s) the plugin does not export — oxlint rejects the whole config: ${missing.join(', ')}`,
  ).toEqual([]);
});

// Rules that check nothing without options, in @jlg/eslint as here (the base
// runs them as `error` with none). The consumers hand them options so their
// code is still proven to run.
const inert = {
  'eslint-js/no-restricted-syntax': ['error', 'DebuggerStatement'],
  'import-js/no-restricted-paths': [
    'error',
    { zones: [{ from: './packages', target: './src' }] },
  ],
  // also needs an `.eslintrc` beside it to enumerate files (eslint-plugin-import#3079)
  'import-js/no-unused-modules': ['error', { unusedExports: true }],
  'react-js/boolean-prop-naming': ['error', { rule: '^is[A-Z]' }],
  'unicorn-js/string-content': ['error', { patterns: { unicorn: '🦄' } }],
};

// At least one violation of every configured jsPlugins rule.
const fixtures = {
  '.eslintrc': '{}\n',
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
    // date conditions are skipped on pull-request CI (ignoreDatesOnPullRequests,
    // via ci-info), so a version condition keeps the rule provably live there
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
    'export const re = /[0-9]/;',
    "export const json = JSON.parse(fs.readFileSync('./package.json', 'utf8'));",
    "export const str = 'unicorn';",
    'export const newThing = [inner, packaged, fresh, old, missing, sibling, assign, obj.a, my_var];',
    '',
    'export function destructure(foo) {',
    '  const { first } = foo;',
    '  return [first, foo.second];',
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

const entries = {
  // JS config: the base arrives as an object, so index.mjs's absolute paths
  // are the only thing locating the plugins
  js: {
    file: 'oxlint.config.mjs',
    source: `import { defineConfig } from '@jlg/oxlint';\nexport default defineConfig({ rules: ${JSON.stringify(inert)} });\n`,
  },
  // raw JSONC, extended by its installed path: plugin paths resolve against
  // the symlinked file
  json: {
    file: '.oxlintrc.json',
    source: JSON.stringify({
      extends: ['./node_modules/@jlg/oxlint/oxlintrc.jsonc'],
      rules: inert,
    }),
  },
};

const runtimes = { bun: process.execPath, node: Bun.which('node') };
const linkers = ['hoisted', 'isolated'];
// timeouts: a cold install of the packed tarball per linker; one lint run
const installTimeout = 300_000;
const lintTimeout = 120_000;
const scratch = mkdtempSync(join(tmpdir(), 'oxlint-js-plugins-'));
const consumers = {};

const write = (root, files) => {
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), source);
  }
};

const run = (command, cwd) => {
  const result = Bun.spawnSync(command, {
    cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `${command.join(' ')} exited ${result.exitCode}: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString().trim();
};

beforeAll(() => {
  const packed = run(
    [process.execPath, 'pm', 'pack', '--destination', scratch, '--quiet'],
    join(import.meta.dirname, '..'),
  );
  // the oxlint the package pins as its peer
  const { oxlint } = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
  ).peerDependencies;
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
    write(directory, fixtures);
    consumers[linker] = directory;
  }
}, installTimeout);

afterAll(() => {
  rmSync(scratch, { force: true, recursive: true });
});

const lint = (runtime, linker, entry) => {
  const directory = consumers[linker];
  rmSync(join(directory, '.oxlintrc.json'), { force: true });
  rmSync(join(directory, 'oxlint.config.mjs'), { force: true });
  writeFileSync(join(directory, entry.file), entry.source);
  const out = join(directory, 'report.json');
  const result = Bun.spawnSync(
    [
      runtime,
      join(directory, 'node_modules', 'oxlint', 'bin', 'oxlint'),
      '-c',
      entry.file,
      '--format',
      'json',
      'src',
    ],
    { cwd: directory, stderr: 'pipe', stdout: Bun.file(out) },
  );
  const text = readFileSync(out, 'utf8');
  if (!text.trim().startsWith('{')) {
    throw new Error(
      `oxlint exited ${result.exitCode}: ${text}${result.stderr.toString()}`,
    );
  }
  return JSON.parse(text).diagnostics;
};

describe.each(Object.entries(runtimes))('on %s', (runtimeName, runtime) => {
  describe.each(linkers)('installed %s', (linker) => {
    test.each(Object.keys(entries))(
      'every configured jsPlugins rule fires through the %s entry',
      (kind) => {
        const diagnostics = lint(runtime, linker, entries[kind]);
        // a crashed plugin drops every JS rule on the file; a crashed rule
        // reports itself through host.mjs
        const broken = diagnostics
          .map((diagnostic) => diagnostic.message)
          .filter((message) =>
            /Error running JS plugin|Rule crashed|Parse errors in imported module/u.test(
              message,
            ),
          );
        expect(broken).toEqual([]);
        const codes = new Set(
          diagnostics.map((diagnostic) =>
            diagnostic.code?.replace(
              /^(?<plugin>.+)\((?<rule>.+)\)$/u,
              '$<plugin>/$<rule>',
            ),
          ),
        );
        expect(configured.filter((name) => !codes.has(name))).toEqual([]);
      },
      lintTimeout,
    );
  });
});

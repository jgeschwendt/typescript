import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnOxlint, write } from './_helpers.js';

// host.mjs runs inside oxlint's process, out of bun's coverage: a probe plugin
// wrapped by it proves the crash containment and the getJSDocComment port
// end to end.
const plugin = `import { host } from ${JSON.stringify(join(import.meta.dirname, '..', 'plugins', 'host.mjs'))};
const kinds = 'ArrowFunctionExpression, ClassDeclaration, ClassExpression, FunctionDeclaration, FunctionExpression, Program';
export default host({ rules: {
  bare: { create: () => ({ onCodePathStart() { throw 'bare'; } }) },
  crash: { create: () => ({ Identifier(node) { throw new Error(node.name); } }) },
  jsdoc: { create: (context) => ({ [kinds](node) {
    context.report({ message: String(context.sourceCode.getJSDocComment(node)?.value), node });
  } }) },
} }, 'probe');
`;

const source = `function first() {}
void (() => {});
/** a */
function declared() {}
/** b */
export class Exported {}
/** c */
const arrow = () => {};
/** d */
const expression = class {};
/** e */
call(() => {}, new Call(() => {}));
/* f */
function block() {}
//* g
function line() {}
/** h */

function gap() {}
/** i */
const object = { method() {} };
/** j */
const outer = function () {
  return () => {};
};
/** k */
function wrap() {
  return () => {};
}
`;

const directory = mkdtempSync(join(tmpdir(), 'oxlint-host-'));
afterAll(() => {
  rmSync(directory, { force: true, recursive: true });
});

test('host contains a crashing rule and ports getJSDocComment', () => {
  write(directory, {
    '.oxlintrc.json': JSON.stringify({
      categories: { correctness: 'off' },
      jsPlugins: ['./probe.mjs'],
      rules: {
        'probe/bare': 'error',
        'probe/crash': 'error',
        'probe/jsdoc': 'error',
      },
    }),
    'lead.js': '/** p */\n;\n(() => {});\n',
    'probe.mjs': plugin,
    'source.js': source,
  });
  const { report } = spawnOxlint(directory, [
    '--format',
    'json',
    'lead.js',
    'source.js',
  ]);
  expect(
    report.diagnostics
      .map(
        ({ code, labels: [{ span }], message }) =>
          `${code} ${span.line}:${span.column} ${message}`,
      )
      .toSorted(),
  ).toEqual([
    "probe(bare) 1:1 Rule crashed under oxlint's JS plugin host: bare",
    "probe(bare) 1:1 Rule crashed under oxlint's JS plugin host: bare",
    "probe(crash) 1:10 Rule crashed under oxlint's JS plugin host: first",
    'probe(jsdoc) 10:20 * d ',
    'probe(jsdoc) 12:25 undefined',
    'probe(jsdoc) 12:6 undefined',
    'probe(jsdoc) 14:1 undefined',
    'probe(jsdoc) 16:1 undefined',
    'probe(jsdoc) 19:1 undefined',
    'probe(jsdoc) 1:1 undefined',
    'probe(jsdoc) 1:1 undefined',
    'probe(jsdoc) 21:24 undefined',
    'probe(jsdoc) 23:15 * j ',
    'probe(jsdoc) 24:10 undefined',
    'probe(jsdoc) 27:1 * k ',
    'probe(jsdoc) 28:10 undefined',
    'probe(jsdoc) 2:1 undefined',
    'probe(jsdoc) 2:7 undefined',
    'probe(jsdoc) 3:2 undefined',
    'probe(jsdoc) 4:1 * a ',
    'probe(jsdoc) 6:8 * b ',
    'probe(jsdoc) 8:15 * c ',
  ]);
});

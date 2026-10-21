import { expect, test } from 'bun:test';
import { scratch, spawnOxlint, write } from './_helpers.js';

const { join } = process.getBuiltinModule('node:path');

// host.js runs inside oxlint's process, out of bun's coverage: a probe plugin proves it end to end
const plugin = `import { host } from ${JSON.stringify(join(import.meta.dirname, '..', 'plugins', 'host.js'))};
const kinds = 'ArrowFunctionExpression, ClassDeclaration, ClassExpression, FunctionDeclaration, FunctionExpression, Program';
export default host({ rules: {
  bare: { create: (context) => ({ onCodePathStart() { throw context.extra; } }) },
  crash: { create: () => ({ Identifier(node) { throw new Error(node.name); } }) },
  jsdoc: { create: (context) => ({ [kinds](node) {
    const sourceCode = context.getSourceCode();
    context.report({ message: String(sourceCode === context.sourceCode && sourceCode.getJSDocComment(node)?.value), node });
  } }) },
} }, 'probe', () => ({ extra: 'bare' }));
`;

const source = `function first() {}
void (() => {});
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
/** l */
class Klass {
  method() {}
}
`;

const directory = scratch('oxlint-host-');

test('host contains a crashing rule and ports getJSDocComment', () => {
  write(directory, {
    'lead.js': '/** p */\n;\n(() => {});\n',
    'probe.json': {
      categories: { correctness: 'off' },
      jsPlugins: ['./probe.mjs'],
      rules: {
        'probe/bare': 'error',
        'probe/crash': 'error',
        'probe/jsdoc': 'error',
      },
    },
    'probe.mjs': plugin,
    'source.js': source,
  });
  /** @type {{ report: { diagnostics: { code: string; labels: [{ span: { column: number; line: number } }]; message: string }[] } }} */
  const { report } = spawnOxlint(directory, ['-c', 'probe.json', 'lead.js', 'source.js']);
  expect(
    report.diagnostics
      .map(
        ({ code, labels, message }) =>
          `${code} ${labels[0].span.line}:${labels[0].span.column} ${message}`,
      )
      .toSorted(),
  ).toEqual([
    "probe(bare) 1:1 Rule crashed under oxlint's JS plugin host: bare",
    "probe(bare) 1:1 Rule crashed under oxlint's JS plugin host: bare",
    "probe(crash) 1:10 Rule crashed under oxlint's JS plugin host: first",
    'probe(jsdoc) 10:25 undefined',
    'probe(jsdoc) 10:6 undefined',
    'probe(jsdoc) 12:1 undefined',
    'probe(jsdoc) 14:1 undefined',
    'probe(jsdoc) 17:1 undefined',
    'probe(jsdoc) 19:24 undefined',
    'probe(jsdoc) 1:1 undefined',
    'probe(jsdoc) 1:1 undefined',
    'probe(jsdoc) 21:15 * j ',
    'probe(jsdoc) 22:10 undefined',
    'probe(jsdoc) 25:1 * k ',
    'probe(jsdoc) 26:10 undefined',
    'probe(jsdoc) 29:1 * l ',
    'probe(jsdoc) 2:1 undefined',
    'probe(jsdoc) 2:7 undefined',
    'probe(jsdoc) 30:9 undefined',
    'probe(jsdoc) 3:2 undefined',
    'probe(jsdoc) 4:8 * b ',
    'probe(jsdoc) 6:15 * c ',
    'probe(jsdoc) 8:20 * d ',
  ]);
});

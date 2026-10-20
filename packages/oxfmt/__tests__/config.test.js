import { expect, test } from 'bun:test';

const { readFileSync } = process.getBuiltinModule('node:fs');
const configUrl = new URL('../oxfmtrc.json', import.meta.url);
const schemaUrl = new URL('configuration_schema.json', import.meta.resolve('oxfmt/package.json'));
/** @param {URL} url */
const read = (url) => JSON.parse(String(readFileSync(url)));

// consumed via `-c` and `import … with { type: "json" }`, both strict JSON, never JSONC
test('oxfmtrc.json parses as strict JSON', () => {
  expect(() => read(configUrl)).not.toThrow();
});

test("every oxfmtrc.json key exists in oxfmt's schema", () => {
  const { properties } = read(schemaUrl);
  const unknown = Object.keys(read(configUrl)).filter((key) => !Object.hasOwn(properties, key));
  expect(unknown, `Unknown oxfmt option key(s) — silently ignored: ${unknown.join(', ')}`).toEqual(
    [],
  );
});

test('sortImports: builtin+external, internal, index, sibling, parent; case-sensitive; no blank lines', () => {
  const sorted = [
    "import fs from 'node:fs';",
    "import type { T } from 'zod';",
    "import alias from '@/alias';",
    "import index from './index.js';",
    "import B from './B.js';",
    "import a from './a.js';",
    "import up from '../up.js';",
  ];
  const bin = new URL('bin/oxfmt', import.meta.resolve('oxfmt/package.json'));
  const { stdout } = Bun.spawnSync(
    [process.execPath, bin.pathname, '-c', configUrl.pathname, '--stdin-filepath', 'x.ts'],
    { stdin: Buffer.from(sorted.toReversed().join('\n')) },
  );
  expect(String(stdout)).toBe(`${sorted.join('\n')}\n`);
});

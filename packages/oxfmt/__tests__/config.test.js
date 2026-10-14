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
  const unknown = Object.keys(read(configUrl)).filter((key) => !(key in properties));
  expect(unknown, `Unknown oxfmt option key(s) — silently ignored: ${unknown.join(', ')}`).toEqual(
    [],
  );
});

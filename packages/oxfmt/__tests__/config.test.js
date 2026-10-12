import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = import.meta.dirname;

const configPath = join(here, '..', 'oxfmtrc.json');

const oxfmtDirectory = dirname(require.resolve('oxfmt/package.json'));
const schemaPath = join(oxfmtDirectory, 'configuration_schema.json');

// consumed via `-c` and `import … with { type: "json" }`, both strict JSON, never JSONC
test('oxfmtrc.json parses as strict JSON', () => {
  expect(() => JSON.parse(readFileSync(configPath))).not.toThrow();
});

test("every oxfmtrc.json key exists in oxfmt's schema", () => {
  const schema = JSON.parse(readFileSync(schemaPath));
  const known = new Set(Object.keys(schema.properties));
  const config = JSON.parse(readFileSync(configPath));
  const unknown = Object.keys(config).filter((key) => !known.has(key));
  expect(unknown, `Unknown oxfmt option key(s) — silently ignored: ${unknown.join(', ')}`).toEqual(
    [],
  );
});

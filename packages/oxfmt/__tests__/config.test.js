import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { expect, test } from 'bun:test';

const require = createRequire(import.meta.url);
const here = import.meta.dirname;

const configPath = join(here, '..', 'oxfmtrc.json');

// Resolve oxfmt from wherever the workspace installed it (root-hoisted or the
// package's own node_modules), then locate its bundled JSON schema.
const oxfmtDir = dirname(require.resolve('oxfmt/package.json'));
const schemaPath = join(oxfmtDir, 'configuration_schema.json');

// oxfmtrc.json is consumed via `-c` and via `import … with { type: "json" }`;
// both demand strict JSON (no comments, no trailing commas). Guard it here —
// unlike the root .oxfmtrc.jsonc, this file may never drift into JSONC.
test('oxfmtrc.json parses as strict JSON', () => {
  expect(() => JSON.parse(readFileSync(configPath, 'utf8'))).not.toThrow();
});

// A key oxfmt does not recognize is silently ignored — the setting simply never
// applies. Guard every key in oxfmtrc.json against oxfmt's own schema so a typo,
// or a key an oxfmt bump renames/removes, fails the suite by name.
test("every oxfmtrc.json key exists in oxfmt's schema", () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const known = new Set(Object.keys(schema.properties));
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const unknown = Object.keys(config).filter((key) => !known.has(key));
  expect(
    unknown,
    `Unknown oxfmt option key(s) — silently ignored: ${unknown.join(', ')}`,
  ).toEqual([]);
});

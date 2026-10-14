import { expect, test } from 'bun:test';
import { enabledScopes, loadRules } from './_helpers.js';

// categories run at error, so a bump's new rules diff here; regenerate: bun test --update-snapshots
// ※ rule-inventory-gate

test('rule inventory for enabled plugins', () => {
  const inventory = loadRules()
    .filter((rule) => enabledScopes.has(rule.scope))
    .map((rule) => `${rule.scope}/${rule.value} | ${rule.category} | type_aware=${rule.type_aware}`)
    .toSorted();
  expect(inventory).toMatchSnapshot();
});

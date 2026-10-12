import { expect, test } from 'bun:test';
import { enabledScopes, loadConfig, loadRules } from './_helpers.js';

// categories run at error, so a bump's new rules diff here; regenerate: bun test --update-snapshots
// ※ rule-inventory-gate

test('rule inventory for enabled plugins', () => {
  const enabled = enabledScopes(loadConfig());
  const inventory = loadRules()
    .filter((rule) => enabled.has(rule.scope))
    .map((rule) => `${rule.scope}/${rule.value} | ${rule.category} | type_aware=${rule.type_aware}`)
    .toSorted();
  expect(inventory).toMatchSnapshot();
});

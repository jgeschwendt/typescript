import { expect, test } from 'bun:test';
import { enabledScopes, loadConfig, loadRules } from './_lib.js';

// The update-review gate. Our config turns whole rule CATEGORIES on at "error"
// (correctness, pedantic, perf, style, suspicious), so any rule oxlint ADDS to one
// of those categories in a future version silently becomes an error for every
// consumer the instant they bump — the same invisibility the existence test
// guards, one level up. This snapshot pins the full inventory (scope/value,
// category, type_aware) of every rule in the plugins we enable; an oxlint bump
// that adds, removes, or recategorizes a rule surfaces as a reviewable diff here
// at update time instead of as a surprise downstream. After an INTENTIONAL bump,
// regenerate with: bun test --update-snapshots
// stele:landmark rule-inventory-gate

test('rule inventory for enabled plugins', () => {
  // Derive the filter from the config's own `plugins` so it can never drift from
  // what the config actually enables.
  const enabled = enabledScopes(loadConfig());
  const inventory = loadRules()
    .filter((rule) => enabled.has(rule.scope))
    .map(
      (rule) =>
        `${rule.scope}/${rule.value} | ${rule.category} | type_aware=${rule.type_aware}`,
    )
    .toSorted();
  expect(inventory).toMatchSnapshot();
});

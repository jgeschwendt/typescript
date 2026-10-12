import { expect, test } from 'bun:test';
import {
  configRuleNames,
  enabledScopes,
  jsPluginScopes,
  loadConfig,
  loadPluginNames,
  loadRules,
  ruleKey,
  ruleScope,
} from './_helpers.js';

// an unknown rule or plugin rejects the whole config; a rule whose plugin is off never runs
// ※ rule-existence-guard

/** jsPlugins rules are ESLint rule code, guarded in js-plugins.test.js */
const nativeRuleNames = (config) => {
  const js = jsPluginScopes(config);
  return configRuleNames(config).filter((name) => !js.has(name.split('/')[0]));
};

test('every configured rule exists in oxlint', () => {
  const known = new Set(loadRules().map((rule) => `${rule.scope}/${rule.value}`));
  const missing = nativeRuleNames(loadConfig()).filter((name) => !known.has(ruleKey(name)));
  expect(
    missing,
    `Unknown oxlint rule name(s) — oxlint rejects the whole config: ${missing.join(', ')}`,
  ).toEqual([]);
});

test('every configured plugin is a valid oxlint plugin', () => {
  const valid = new Set(loadPluginNames());
  const invalid = (loadConfig().plugins ?? []).filter((plugin) => !valid.has(plugin));
  expect(
    invalid,
    `Unknown oxlint plugin name(s) — oxlint rejects the whole config: ${invalid.join(', ')}`,
  ).toEqual([]);
});

test("every configured rule's plugin is enabled", () => {
  const config = loadConfig();
  const enabled = enabledScopes(config);
  const orphaned = nativeRuleNames(config).filter((name) => !enabled.has(ruleScope(name)));
  expect(
    orphaned,
    `Rule(s) whose plugin is not in \`plugins\` — silent no-op, never run: ${orphaned.join(', ')}`,
  ).toEqual([]);
});

// oxlint cannot drop a plugin per override, so the JS override must name every typescript rule
test('every category-enabled typescript rule is off on JavaScript files', () => {
  const config = loadConfig();
  const javascript = config.overrides.find(
    (override) => override.files.join(',') === '**/*.{cjs,js,jsx,mjs}',
  );
  const on = new Set(
    Object.entries(config.categories)
      .filter(([, severity]) => severity !== 'off')
      .map(([category]) => category),
  );
  const leaking = loadRules()
    .filter((rule) => rule.scope === 'typescript' && on.has(rule.category))
    .map((rule) => `typescript/${rule.value}`)
    .filter((name) => config.rules[name] !== 'off' && javascript.rules[name] !== 'off');
  expect(leaking, `typescript rule(s) running on JavaScript files: ${leaking.join(', ')}`).toEqual(
    [],
  );
});

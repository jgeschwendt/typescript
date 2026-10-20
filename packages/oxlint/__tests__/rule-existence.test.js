import { expect, test } from 'bun:test';
import {
  config,
  enabledScopes,
  isJsRule,
  loadRules,
  overrides,
  ruleKey,
  ruleNames,
} from './_helpers.js';

// an unknown rule or plugin rejects the whole config; a rule whose plugin is off never runs ※ rule-existence-guard

/** jsPlugins rules are ESLint rule code, guarded in js-plugins.test.js */
const native = ruleNames.filter((name) => !isJsRule(name));

test('every configured rule exists in an enabled oxlint plugin', () => {
  const known = new Set(
    loadRules()
      .filter((rule) => enabledScopes.has(rule.scope))
      .map((rule) => `${rule.scope}/${rule.value}`),
  );
  const missing = native.filter((name) => !known.has(ruleKey(name)));
  expect(
    missing,
    `Rule(s) oxlint lacks (rejects the whole config) or whose plugin is not in \`plugins\` (silent no-op): ${missing.join(', ')}`,
  ).toEqual([]);
});

// oxlint cannot drop a plugin per override, so the JS override must name every TypeScript rule
test('every category-enabled typescript rule is off on JavaScript files', () => {
  const { rules: javascript = {} } =
    overrides.find((override) => override.files.join(',') === '**/*.{cjs,js,jsx,mjs}') ?? {};
  const on = new Set(
    Object.entries(config.categories ?? {})
      .filter(([, severity]) => severity !== 'off')
      .map(([category]) => category),
  );
  const leaking = loadRules()
    .filter((rule) => rule.scope === 'typescript' && on.has(rule.category))
    .map((rule) => `typescript/${rule.value}`)
    .filter((name) => config.rules?.[name] !== 'off' && javascript[name] !== 'off');
  expect(leaking, `typescript rule(s) running on JavaScript files: ${leaking.join(', ')}`).toEqual(
    [],
  );
});

import { expect, test } from 'bun:test';
import {
  config,
  enabledScopes,
  jsScopes,
  loadRules,
  overrides,
  ruleKey,
  ruleNames,
} from './_helpers.js';

// an unknown rule or plugin rejects the whole config; a rule whose plugin is off never runs ※ rule-existence-guard

const catalog = loadRules();

test('every configured rule exists in an enabled oxlint plugin', () => {
  const missing = ruleNames.filter(
    // jsPlugins rules: lint.test.js (oxlint's config load) guards them, js-plugins.test.js's Node-20 consumer the `floors` offs
    (name) => !jsScopes.has(name.replace(/\/.*/u, '')) && !catalog.has(ruleKey(name)),
  );
  expect(
    missing,
    `Rule(s) oxlint lacks (rejects the whole config) or whose plugin is not in \`plugins\` (silent no-op): ${missing.join(', ')}`,
  ).toEqual([]);
});

test('every enabled plugin has rules in the catalog', () => {
  const scopes = new Set(Array.from(catalog.values(), ({ scope }) => scope));
  expect([...enabledScopes].filter((scope) => !scopes.has(scope))).toEqual([]);
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
  const leaking = [...catalog]
    .filter(
      ([name, { category, scope }]) =>
        scope === 'typescript' &&
        on.has(category) &&
        config.rules?.[name] !== 'off' &&
        javascript[name] !== 'off',
    )
    .map(([name]) => name);
  expect(leaking, `typescript rule(s) running on JavaScript files: ${leaking.join(', ')}`).toEqual(
    [],
  );
});

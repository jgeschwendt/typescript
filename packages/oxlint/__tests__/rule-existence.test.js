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

// The footgun guard. Two ways a config rule silently stops doing its job in
// oxlint (re-verified 2026-09-08 · probe, oxlint 1.82):
//
//  1. An unknown rule NAME, or an unknown PLUGIN name, makes oxlint reject the
//     WHOLE config ("Failed to parse … Rule 'x' not found in plugin 'y'" /
//     "Unknown plugin"), exit 1, and lint nothing — the same when the config is
//     pulled in via `extends`. Loud, but blunt: every rule the config defined
//     stops applying, and downstream it reads as a cryptic parse failure rather
//     than "you typo'd a rule". These tests catch it here, by name.
//  2. A VALID rule whose plugin is NOT in `plugins` (e.g. `unicorn/no-null` while
//     `plugins` omits `unicorn`) parses fine, exits 0, and simply never runs.
//     This is the genuinely silent case; the third test below guards it.
// ※ rule-existence-guard

// Native rules only: `jsPlugins` rules are ESLint rule code, guarded against
// their plugins in js-plugins.test.js.
const nativeRuleNames = (config) => {
  const js = jsPluginScopes(config);
  return configRuleNames(config).filter((name) => !js.has(name.split('/')[0]));
};

test('every configured rule exists in oxlint', () => {
  const known = new Set(
    loadRules().map((rule) => `${rule.scope}/${rule.value}`),
  );
  const missing = nativeRuleNames(loadConfig()).filter(
    (name) => !known.has(ruleKey(name)),
  );
  expect(
    missing,
    `Unknown oxlint rule name(s) — oxlint rejects the whole config: ${missing.join(', ')}`,
  ).toEqual([]);
});

test('every configured plugin is a valid oxlint plugin', () => {
  const valid = new Set(loadPluginNames());
  const invalid = (loadConfig().plugins ?? []).filter(
    (plugin) => !valid.has(plugin),
  );
  expect(
    invalid,
    `Unknown oxlint plugin name(s) — oxlint rejects the whole config: ${invalid.join(', ')}`,
  ).toEqual([]);
});

test("every configured rule's plugin is enabled", () => {
  const config = loadConfig();
  const enabled = enabledScopes(config);
  const orphaned = nativeRuleNames(config).filter(
    (name) => !enabled.has(ruleScope(name)),
  );
  expect(
    orphaned,
    `Rule(s) whose plugin is not in \`plugins\` — silent no-op, never run: ${orphaned.join(', ')}`,
  ).toEqual([]);
});

// @jlg/eslint ran typescript-eslint on TS files only, and oxlint cannot drop a
// plugin per override, so the JS-files override names every typescript rule
// the categories turn on. A rule oxlint adds to the typescript plugin would
// otherwise start firing on .js/.cjs/.mjs files (type-aware ones included).
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
    .filter(
      (name) =>
        config.rules[name] !== 'off' && javascript.rules[name] !== 'off',
    );
  expect(
    leaking,
    `typescript rule(s) running on JavaScript files: ${leaking.join(', ')}`,
  ).toEqual([]);
});

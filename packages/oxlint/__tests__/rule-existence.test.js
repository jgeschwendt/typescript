import { expect, test } from 'bun:test';
import {
  configRuleNames,
  enabledScopes,
  loadConfig,
  loadPluginNames,
  loadRules,
  ruleKey,
  ruleScope,
} from './_lib.js';

// The footgun guard. Two ways a config rule silently stops doing its job in
// oxlint 1.74 (verified 2026-07-19):
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
// stele:landmark rule-existence-guard

test('every configured rule exists in oxlint', () => {
  const known = new Set(
    loadRules().map((rule) => `${rule.scope}/${rule.value}`),
  );
  const missing = configRuleNames(loadConfig()).filter(
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
  const orphaned = configRuleNames(config).filter(
    (name) => !enabled.has(ruleScope(name)),
  );
  expect(
    orphaned,
    `Rule(s) whose plugin is not in \`plugins\` — silent no-op, never run: ${orphaned.join(', ')}`,
  ).toEqual([]);
});

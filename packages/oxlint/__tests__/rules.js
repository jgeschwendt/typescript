import { builtinRules } from 'eslint/use-at-your-own-risk';
import react from 'eslint-plugin-react';
import unicorn from 'eslint-plugin-unicorn';
import { config, enabledScopes, loadRules, overrides, ruleKey } from './_helpers.js';

const { readdirSync } = process.getBuiltinModule('node:fs');

const { default: typescript } = await import('@typescript-eslint/eslint-plugin');

/** per file: the plugin's index throws at load on ESLint 10 */
const importRules = new URL('rules/', import.meta.resolve('eslint-plugin-import'));

/** @type {[string, string, Record<string, { meta?: { deprecated?: unknown } }> | undefined][]} */
const catalogs = [
  ['', 'eslint', Object.fromEntries(builtinRules)],
  ['@typescript-eslint/', 'typescript', typescript.rules],
  [
    'import/',
    'import',
    Object.fromEntries(
      readdirSync(importRules).map((file) => [
        file.replace(/\.js$/u, ''),
        import.meta.require(Bun.fileURLToPath(new URL(file, importRules))),
      ]),
    ),
  ],
  ['react/', 'react', react.rules],
  ['unicorn/', 'unicorn', unicorn.rules],
];

/** @type {Record<string, [string, ...unknown[]]>[]} */
const blocks = Object.values(
  await Bun.file(new URL('fixtures/eslint-baseline.json', import.meta.url)).json(),
);

/** @param {string} prefixed the rule's name in @jlg/eslint */
const prior = (prefixed) => {
  const seen = blocks.map((block) => block[prefixed]).filter((value) => value !== undefined);
  const on = seen.find(([state]) => state !== 'off');
  return { old: on ? 'on' : (seen[0]?.[0] ?? 'absent'), oldOptions: on?.slice(1) ?? [] };
};
const eslint = new Map(
  catalogs.flatMap(([prefix, scope, rules]) =>
    Object.entries(rules ?? {})
      .filter(([, rule]) => !rule.meta?.deprecated)
      .map(([rule]) => [`${scope}/${rule}`, prior(`${prefix}${rule}`)]),
  ),
);

const levels = new Map(Object.entries(config.categories ?? {}));
const native = new Map(
  loadRules()
    .filter((rule) => enabledScopes.has(rule.scope))
    .map((rule) => [`${rule.scope}/${rule.value}`, rule]),
);

/** @param {Record<string, unknown>[]} sets */
const entries = (sets) =>
  new Map(
    sets.flatMap((rules) =>
      Object.entries(rules).map(([name, value]) => [ruleKey(name), [value].flat()]),
    ),
  );
const top = entries([config.rules ?? {}]);
const scoped = entries(overrides.map((override) => override.rules ?? {}));

/**
 * top-level rules, then the category, then any override: `[severity, ...options]`
 * @param {string} key
 */
const entry = (key) => {
  const level = levels.get(native.get(key)?.category ?? '');
  return top.get(key) ?? (level && [level]) ?? scoped.get(key);
};

/**
 * the options @jlg/eslint set against this base's, and why they differ; `-` without an ESLint counterpart
 * @param {unknown[] | undefined} was
 * @param {unknown[]} now
 * @returns {[string, string?]}
 */
const compare = (was, now) => {
  if (!was) {
    return ['-'];
  }
  if (Bun.deepEquals(was, now)) {
    return [was.length > 0 ? 'same' : 'none'];
  }
  if (now.length === 0) {
    return ['differs', 'base sets none'];
  }
  return ['differs', was.length > 0 ? 'values differ' : 'old sets none'];
};

/**
 * every non-deprecated rule of @jlg/eslint's catalogs and every oxlint rule of the enabled plugins
 * @type {{ base: unknown; baseOptions: unknown[]; category: string; old: string; oldOptions?: unknown[]; options: string; oxlint: string; reason?: string; rule: string }[]}
 */
const rows = [...new Set([...eslint.keys(), ...native.keys()])].map((rule) => {
  const js = ruleKey(rule.replace('/', '-js/'));
  const [base, ...baseOptions] = entry(rule) ?? entry(js) ?? ['off'];
  const { old = '-', oldOptions } = eslint.get(rule) ?? {};
  const { category = '-', type_aware: typed } = native.get(rule) ?? {};
  const oxlint = native.has(rule)
    ? `native${typed ? ' (type-aware)' : ''}`
    : ((entry(js) && 'js') ?? 'none');
  const [options = '', reason] = compare(oldOptions, baseOptions);
  return { base, baseOptions, category, old, oldOptions, options, oxlint, reason, rule };
});

export { rows };

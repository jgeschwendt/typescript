import { expect, test } from 'bun:test';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import react from 'eslint-plugin-react';
import unicorn from 'eslint-plugin-unicorn';
import { config, enabledScopes, loadRules, overrides, ruleKey } from './_helpers.js';

const { readdirSync } = process.getBuiltinModule('node:fs');

// every non-deprecated rule of @jlg/eslint's catalogs and every oxlint rule of the enabled plugins:
// <rule> | <category> | <old> | <oxlint> | <base> | <options>; categories run at error, so a bump's
// new rules diff here; regenerate: bun test --update-snapshots, then bun run report
// ※ rules-gate

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
const old = (prefixed) => {
  const seen = blocks.map((block) => block[prefixed]).filter((value) => value !== undefined);
  const on = seen.find(([state]) => state !== 'off');
  return { state: on ? 'on' : (seen[0]?.[0] ?? 'absent'), was: on?.slice(1) ?? [] };
};
const eslint = new Map(
  catalogs.flatMap(([prefix, scope, rules]) =>
    Object.entries(rules ?? {})
      .filter(([, rule]) => !rule.meta?.deprecated)
      .map(([rule]) => [`${scope}/${rule}`, old(`${prefix}${rule}`)]),
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
 * the options @jlg/eslint set against this base's; `-` without an ESLint counterpart
 * @param {unknown[] | undefined} was
 * @param {unknown[]} now
 */
const compare = (was, now) => {
  if (!was) {
    return '-';
  }
  if (was.length + now.length === 0) {
    return 'none';
  }
  return Bun.deepEquals(was, now) ? 'same' : 'differs';
};

const rows = [...new Set([...eslint.keys(), ...native.keys()])].map((key) => {
  const js = ruleKey(key.replace('/', '-js/'));
  const base = entry(key) ?? entry(js) ?? ['off'];
  const { state = '-', was } = eslint.get(key) ?? {};
  const { category = '-', type_aware: typed } = native.get(key) ?? {};
  const oxlint = native.has(key)
    ? `native${typed ? ' (type-aware)' : ''}`
    : ((entry(js) && 'js') ?? 'none');
  return [key, category, state, oxlint, base[0], compare(was, base.slice(1))];
});

/** on in @jlg/eslint and native in oxlint, off here by choice: nursery, or one blanket component style */
const deliberate = new Set([
  'eslint/no-restricted-exports',
  'eslint/no-undef',
  'eslint/no-unreachable-loop',
  'eslint/no-useless-assignment',
  'import/export',
  'import/named',
  'react/function-component-definition',
  'react/require-render-return',
  'typescript/no-unnecessary-condition',
  'typescript/prefer-optional-chain',
]);

test('rules', () => {
  const dropped = rows
    .filter(
      ([rule = '', , state, oxlint = '', base]) =>
        state === 'on' && oxlint.startsWith('native') && base === 'off' && !deliberate.has(rule),
    )
    .map(([rule]) => rule);
  expect(dropped, `on in @jlg/eslint, native in oxlint, off here: ${dropped.join(', ')}`).toEqual(
    [],
  );
  expect(rows.map((row) => row.join(' | ')).toSorted()).toMatchSnapshot();
});

import { config, loadRules, off, overrides, ruleKey } from './_helpers.js';

/** @typedef {{ meta?: { deprecated?: unknown; docs?: { extendsBaseRule?: boolean | string; requiresTypeChecking?: boolean } } }} Rule */

const levels = new Map(Object.entries(config.categories ?? {}));
const native = loadRules();
/**
the wrapped plugins' upstream catalogs: a host lists only the rules a config turns on
@type {Record<string, Record<string, Rule>>}
*/
const upstream = Object.fromEntries(
  await Promise.all(
    Object.entries({
      eslint: 'eslint/use-at-your-own-risk',
      import: 'eslint-plugin-import',
      react: 'eslint-plugin-react',
      typescript: '@typescript-eslint/eslint-plugin',
      unicorn: 'eslint-plugin-unicorn',
    }).map(async ([scope, specifier]) => {
      /** @type {{ default: { builtinRules: Map<string, Rule>; rules?: Record<string, Rule> } }} */
      const { default: plugin } = await import(specifier);
      return [scope, plugin.rules ?? Object.fromEntries(plugin.builtinRules)];
    }),
  ),
);
/** the live rules, `scope/name` to whether they need types */
const wrapped = new Map(
  Object.entries(upstream).flatMap(([scope, rules]) =>
    Object.entries(rules)
      .filter(([, { meta }]) => !meta?.deprecated)
      .map(([name, { meta }]) => [`${scope}/${name}`, meta?.docs?.requiresTypeChecking]),
  ),
);
const reasons = new Map(Object.entries(off).map(([key, reason]) => [ruleKey(key), reason]));

/** @type {(name: string, value: unknown) => [string, unknown[]]} */
const pair = (name, value) => [ruleKey(name), [value].flat()];
/** first set wins: overrides narrow from the whole language down to one file name @param {Record<string, unknown>[]} sets */
const entries = (sets) =>
  new Map(
    sets
      .flatMap((rules) => Object.entries(rules).map(([name, value]) => pair(name, value)))
      .toReversed(),
  );
const top = entries([config.rules ?? {}]);
const scoped = entries(overrides.map((override) => override.rules ?? {}));

/** top-level rules, then the category, then the broadest override: `[severity, ...options]` @param {string} key */
const entry = (key) => {
  const level = levels.get(native.get(key)?.category ?? '');
  return top.get(key) ?? (level && [level]) ?? scoped.get(key);
};

const rows = [...new Set([...wrapped.keys(), ...native.keys()])].map((rule) => {
  const js = ruleKey(rule.replace('/', '-js/'));
  const [base, ...baseOptions] = entry(rule) ?? entry(js) ?? ['off'];
  const { category = '-', type_aware: typed } = native.get(rule) ?? {};
  const oxlint = native.has(rule)
    ? `native${typed ? ' (type-aware)' : ''}`
    : ((entry(js) && 'js') ?? 'none');
  const options = base === 'off' || oxlint === 'none' || baseOptions.length === 0 ? '-' : 'set';
  const reason =
    reasons.get(rule) ??
    reasons.get(js) ??
    (oxlint === 'none' && wrapped.get(rule)
      ? 'needs type information the JS plugin host has none of'
      : '');
  return { base, baseOptions, category, options, oxlint, reason, rule };
});

export { rows, upstream };

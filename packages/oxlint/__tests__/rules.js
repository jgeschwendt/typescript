import { config, loadRules, overrides, ruleKey } from './_helpers.js';

const levels = new Map(Object.entries(config.categories ?? {}));
const native = loadRules();
const wrapped = await Promise.all(
  ['eslint', 'import', 'react', 'typescript', 'unicorn'].map(async (scope) => {
    /** @type {{ default: { rules: Record<string, { meta?: { deprecated?: unknown } }> } }} */
    const { default: plugin } = await import(`../plugins/${scope}-js.js`);
    return Object.keys(plugin.rules)
      .filter((name) => !plugin.rules[name]?.meta?.deprecated)
      .map((name) => `${scope}/${name}`);
  }),
);

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

const rows = [...new Set([...wrapped.flat(), ...native.keys()])].map((rule) => {
  const js = ruleKey(rule.replace('/', '-js/'));
  const [base, ...baseOptions] = entry(rule) ?? entry(js) ?? ['off'];
  const { category = '-', type_aware: typed } = native.get(rule) ?? {};
  const oxlint = native.has(rule)
    ? `native${typed ? ' (type-aware)' : ''}`
    : ((entry(js) && 'js') ?? 'none');
  const options = base === 'off' || oxlint === 'none' || baseOptions.length === 0 ? '-' : 'set';
  return { base, baseOptions, category, options, oxlint, rule };
});

export { rows };

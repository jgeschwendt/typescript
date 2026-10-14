import { config, enabledScopes, loadRules, overrides, ruleKey } from './_helpers.js';

/** @type {[string, string, Record<string, { defaultOptions?: unknown[]; meta?: { defaultOptions?: unknown[]; deprecated?: unknown } }>][]} */
const catalogs = await Promise.all(
  [
    ['', 'eslint'],
    ['@typescript-eslint/', 'typescript'],
    ['import/', 'import'],
    ['react/', 'react'],
    ['unicorn/', 'unicorn'],
  ].map(async ([prefix = '', scope = '']) => {
    const { default: plugin } = await import(`../plugins/${scope}-js.mjs`);
    return [prefix, scope, plugin.rules];
  }),
);

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
    Object.entries(rules)
      .filter(([, { meta }]) => !meta?.deprecated)
      .map(([name, rule]) => [
        `${scope}/${name}`,
        {
          ...prior(`${prefix}${name}`),
          defaults: rule.meta?.defaultOptions ?? rule.defaultOptions ?? [],
        },
      ]),
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
top-level rules, then the category, then any override: `[severity, ...options]`
@param {string} key
*/
const entry = (key) => {
  const level = levels.get(native.get(key)?.category ?? '');
  return top.get(key) ?? (level && [level]) ?? scoped.get(key);
};

const merge = new URL('shared/deep-merge-arrays.js', import.meta.resolve('eslint'));
/** @type {{ deepMergeArrays: (defaults: unknown[], options: unknown[]) => unknown[] }} ESLint's own option resolution */
const { deepMergeArrays } = import.meta.require(Bun.fileURLToPath(merge));

/**
@jlg/eslint's options against the base's, or against the declared defaults when the base passes none; `-` without an ESLint counterpart
@param {unknown[] | undefined} was
@param {unknown[]} now
@param {unknown[]} defaults
@returns {[string, string?]}
*/
const compare = (was, now, defaults) => {
  if (!was) {
    return ['-'];
  }
  if (now.length > 0 || was.length === 0) {
    return Bun.deepEquals(was, now)
      ? [was.length > 0 ? 'same' : 'none']
      : ['differs', was.length > 0 ? 'values differ' : 'old sets none'];
  }
  if (defaults.length === 0) {
    return ['unverified'];
  }
  return Bun.deepEquals(deepMergeArrays(defaults, was), defaults)
    ? ['same']
    : ['differs', 'off defaults'];
};

/**
every non-deprecated rule of @jlg/eslint's catalogs and every oxlint rule of the enabled plugins
@type {{ base: unknown; baseOptions: unknown[]; category: string; old: string; oldOptions?: unknown[]; options: string; oxlint: string; reason?: string; rule: string }[]}
*/
const rows = [...new Set([...eslint.keys(), ...native.keys()])].map((rule) => {
  const js = ruleKey(rule.replace('/', '-js/'));
  const [base, ...baseOptions] = entry(rule) ?? entry(js) ?? ['off'];
  const { defaults = [], old = '-', oldOptions } = eslint.get(rule) ?? {};
  const { category = '-', type_aware: typed } = native.get(rule) ?? {};
  const oxlint = native.has(rule)
    ? `native${typed ? ' (type-aware)' : ''}`
    : ((entry(js) && 'js') ?? 'none');
  const [options = '', reason] = compare(oldOptions, baseOptions, defaults);
  return { base, baseOptions, category, old, oldOptions, options, oxlint, reason, rule };
});

export { rows };

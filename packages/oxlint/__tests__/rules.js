import { config, enabledScopes, loadRules, overrides, ruleKey } from './_helpers.js';

/** @type {[string, string, Record<string, { defaultOptions?: unknown[]; meta?: { defaultOptions?: unknown[]; deprecated?: unknown; schema?: unknown } }>][]} */
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
          schema: rule.meta?.schema,
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
every key the schema's object properties name, at any depth
@param {any} schema
@returns {string[]}
*/
const known = (schema) =>
  schema && typeof schema === 'object'
    ? [
        ...Object.keys(schema.properties ?? {}),
        ...Object.values(schema).flatMap((value) => known(value)),
      ]
    : [];

/** @param {unknown[]} options the keys of its object positions */
const fields = (options) =>
  options.flatMap((option) => (option?.constructor === Object ? Object.keys(option) : []));

/**
@jlg/eslint's options against the base's, each resolved over the rule's declared defaults as ESLint does and read over the keys the rule knows, so an oxlint-only key never counts
@param {unknown[]} was
@param {unknown[]} now
@param {{ defaults?: unknown[]; schema?: unknown }} rule
@returns {[string, string?]}
*/
const compare = (was, now, { defaults = [], schema }) => {
  const keys = new Set([...known(schema), ...fields(defaults)]);
  const drift = [...new Set(fields(was))].flatMap((key) => (keys.has(key) ? [] : [key]));
  if (drift.length > 0) {
    return ['unverified', `schema drift: ${drift.join(', ')}`];
  }
  if (was.length + now.length === 0) {
    return ['none'];
  }
  if (defaults.length + now.length === 0) {
    return ['unverified', 'no declared defaults'];
  }
  /** @param {unknown[]} options */
  const effective = (options) =>
    deepMergeArrays(defaults, options).map((option) =>
      option?.constructor === Object
        ? Object.fromEntries(Object.entries(option).filter(([key]) => keys.has(key)))
        : option,
    );
  if (Bun.deepEquals(effective(was), effective(now))) {
    return ['same'];
  }
  if (was.length === 0) {
    return ['differs', 'old sets none'];
  }
  return ['differs', now.length > 0 ? 'values differ' : 'off defaults'];
};

/**
every non-deprecated rule of @jlg/eslint's catalogs and every oxlint rule of the enabled plugins
@type {{ base: unknown; baseOptions: unknown[]; category: string; old: string; oldOptions?: unknown[]; options: string; oxlint: string; reason?: string; rule: string }[]}
*/
const rows = [...new Set([...eslint.keys(), ...native.keys()])].map((rule) => {
  const js = ruleKey(rule.replace('/', '-js/'));
  const [base, ...baseOptions] = entry(rule) ?? entry(js) ?? ['off'];
  const { old = '-', oldOptions, ...declared } = eslint.get(rule) ?? {};
  const { category = '-', type_aware: typed } = native.get(rule) ?? {};
  const oxlint = native.has(rule)
    ? `native${typed ? ' (type-aware)' : ''}`
    : ((entry(js) && 'js') ?? 'none');
  /** `-` without an ESLint counterpart or where the base runs no such rule */
  const [options = '', reason] =
    !oldOptions || base === 'off' || oxlint === 'none'
      ? ['-']
      : compare(oldOptions, baseOptions, declared);
  return { base, baseOptions, category, old, oldOptions, options, oxlint, reason, rule };
});

export { rows };

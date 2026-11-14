import { expect, test } from 'bun:test';
import { config, off, ruleKey } from './_helpers.js';
import { rows, upstream } from './rules.js';

// <rule> | <category> | <oxlint> | <type-aware> | <base> | <options> | <reason>; categories run at error, so a bump's new rules diff here; regenerate: bun test --update-snapshots, then bun run report ※ rules-gate

test('rules', () => {
  expect(
    rows
      .map(({ base, category, options, oxlint, reason, rule, 'type-aware': typed }) =>
        [rule, category, oxlint, typed, base, options, reason].join(' | '),
      )
      .toSorted(),
  ).toMatchSnapshot();
});

test('no reasonless off: every top-level off and every rule that never runs says why', () => {
  expect([
    ...Object.keys(config.rules ?? {}).filter(
      (key) => config.rules?.[key] === 'off' && !Object.hasOwn(off, key),
    ),
    ...rows.filter(({ oxlint, reason }) => oxlint === 'none' && !reason).map(({ rule }) => rule),
  ]).toEqual([]);
});

test('off is frozen and names only a native rule or a -js rule oxlint lacks: any other key is a silent no-op', () => {
  const oxlint = new Map(rows.map((row) => [row.rule, row.oxlint]));
  expect(Object.isFrozen(off)).toBe(true);
  expect(
    Object.keys(off).filter((key) =>
      key.includes('-js/')
        ? oxlint.get(ruleKey(key.replace('-js/', '/'))) !== 'none'
        : oxlint.get(ruleKey(key)) !== 'native',
    ),
  ).toEqual([]);
});

test("typescript-eslint's extensions share their core rule's name, but index.js's `renamed`", () => {
  const { eslint = {}, typescript = {} } = upstream;
  expect(
    Object.entries(typescript).flatMap(([name, { meta }]) => {
      const base = meta?.docs?.extendsBaseRule;
      return (base === true ? name : base) === (Object.hasOwn(eslint, name) ? name : undefined)
        ? []
        : [[name, base]];
    }),
  ).toEqual([['only-throw-error', 'no-throw-literal']]);
});

const named = new Set(
  Object.entries(upstream).flatMap(([scope, rules]) =>
    Object.keys(rules).map((name) => `${scope}/${name}`),
  ),
);
const on = new Set(rows.filter(({ base }) => base !== 'off').map(({ rule }) => rule));

/**
a deprecated rule's successors in its own plugin, bare: `replacedBy` names, or ESLint's `deprecated.replacedBy` objects without a `plugin`
@param {import('./rules.js').Rule['meta']} meta
*/
const successors = (meta) =>
  [
    meta?.replacedBy ?? [],
    (typeof meta?.deprecated === 'object' && meta.deprecated.replacedBy) || [],
  ]
    .flat()
    .filter((by) => typeof by === 'string' || !by.plugin)
    .map((by) => (typeof by === 'string' ? by : by.rule.name).replace(/^.*\//u, ''));

test('no deprecated rule runs beside a successor of its own plugin: only a native one has a row', () => {
  expect(
    Object.entries(upstream).flatMap(([scope, rules]) =>
      Object.entries(rules)
        .filter(
          ([name, { meta }]) =>
            on.has(`${scope}/${name}`) &&
            successors(meta).some((successor) => on.has(`${scope}/${successor}`)),
        )
        .map(([name]) => `${scope}/${name}`),
    ),
  ).toEqual([]);
});

// a new name here is a rename or a new native rule: find its JS twin and add it to `off`
test('the native rules of the wrapped scopes whose name upstream no longer has', () => {
  expect(
    rows
      .filter(
        ({ oxlint, rule }) =>
          oxlint === 'native' &&
          Object.hasOwn(upstream, rule.replace(/\/.*/u, '')) &&
          !named.has(rule),
      )
      .map(({ rule }) => rule),
  ).toEqual([
    'react/capitalized-calls',
    'react/error-boundaries',
    'react/exhaustive-deps',
    'react/exhaustive-effect-dependencies',
    'react/globals',
    'react/hooks',
    'react/immutability',
    'react/incompatible-library',
    'react/invariant',
    'react/memo-dependencies',
    'react/no-clone-element',
    'react/no-deriving-state-in-effects',
    'react/no-react-children',
    'react/only-export-components',
    'react/prefer-function-component',
    'react/preserve-manual-memoization',
    'react/purity',
    'react/refs',
    'react/rule-suppression',
    'react/rules-of-hooks',
    'react/set-state-in-effect',
    'react/set-state-in-render',
    'react/static-components',
    'react/syntax',
    'react/todo',
    'react/unsupported-syntax',
    'react/use-memo',
    'react/void-use-memo',
    'typescript/ban-types',
    'unicorn/no-array-for-each',
  ]);
});

test('a running -js rule shares its bare name with a native rule of another scope only as a reviewed pair', async () => {
  const { definitions } = await Bun.file(
    new URL('configuration_schema.json', import.meta.resolve('oxlint/package.json')),
  ).json();
  const bare = new Set(
    Object.keys(definitions.DummyRuleMap.properties).map((key) => key.replace(/^.*\//u, '')),
  );
  expect(
    rows
      .filter(
        ({ oxlint, rule }) =>
          oxlint === 'js' && on.has(rule) && bare.has(rule.replace(/^.*\//u, '')),
      )
      .map(({ rule }) => rule),
  ).toEqual([
    // the TypeScript twins, split by file kind
    'eslint/consistent-return',
    'eslint/dot-notation',
    // TypeScript's no-deprecated: a different rule, a partial overlap
    'import/no-deprecated',
    'react/no-deprecated',
    // nextjs/no-typos: unrelated
    'react/no-typos',
    // import/no-named-default misses `export { x as default }`
    'unicorn/no-named-default',
    // the core rule misses the template-literal forms
    'unicorn/operator-assignment',
    // the TypeScript one is type-aware, TS only
    'unicorn/require-array-sort-compare',
  ]);
});

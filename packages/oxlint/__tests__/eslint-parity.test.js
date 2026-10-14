import { expect, test } from 'bun:test';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import react from 'eslint-plugin-react';
import unicorn from 'eslint-plugin-unicorn';
import { config, loadRules, overrides, ruleKey } from './_helpers.js';

const { readdirSync } = process.getBuiltinModule('node:fs');

// every non-deprecated rule of @jlg/eslint's catalogs: <rule> | <old> | <oxlint> | <base> | <options>
// regenerate: bun test --update-snapshots, then bun run report

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

const levels = new Map(Object.entries(config.categories ?? {}));
const native = new Map(
  loadRules().map((rule) => [`${rule.scope}/${rule.value}`, levels.get(rule.category)]),
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
const entry = (key) => top.get(key) ?? (native.get(key) && [native.get(key)]) ?? scoped.get(key);

const lines = catalogs
  .flatMap(([prefix, scope, rules]) =>
    Object.entries(rules ?? {})
      .filter(([, rule]) => !rule.meta?.deprecated)
      .map(([rule]) => {
        const seen = blocks
          .map((block) => block[`${prefix}${rule}`])
          .filter((value) => value !== undefined);
        const on = seen.find(([state]) => state !== 'off');
        const js = ruleKey(`${scope}-js/${rule}`);
        const base = entry(`${scope}/${rule}`) ?? entry(js) ?? ['off'];
        const [was, now] = [on ?? [], base].map((options) => options.slice(1));
        const options = Bun.deepEquals(was, now) ? 'same' : 'differs';
        const oxlint = native.has(`${scope}/${rule}`) ? 'native' : ((entry(js) && 'js') ?? 'none');
        return `${prefix}${rule} | ${on ? 'on' : (seen[0]?.[0] ?? 'absent')} | ${oxlint} | ${base[0]} | ${was.length + now.length > 0 ? options : 'none'}`;
      }),
  )
  .toSorted();

/** on in @jlg/eslint and native in oxlint, off here by choice: nursery, or one blanket component style */
const deliberate = new Set([
  '@typescript-eslint/no-unnecessary-condition',
  '@typescript-eslint/prefer-optional-chain',
  'import/export',
  'import/named',
  'no-restricted-exports',
  'no-undef',
  'no-unreachable-loop',
  'no-useless-assignment',
  'react/function-component-definition',
  'react/require-render-return',
]);

test('eslint parity', () => {
  const dropped = lines.filter(
    (line) => line.includes(' | on | native | off |') && !deliberate.has(line.split(' ')[0] ?? ''),
  );
  expect(dropped, `on in @jlg/eslint, native in oxlint, off here: ${dropped.join(', ')}`).toEqual(
    [],
  );
  expect(lines).toMatchSnapshot();
});

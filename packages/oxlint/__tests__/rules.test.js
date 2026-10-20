import { expect, test } from 'bun:test';
import { rows } from './rules.js';

// <rule> | <category> | <old> | <oxlint> | <base> | <options>; categories run at error, so a bump's new rules diff here; regenerate: bun test --update-snapshots, then bun run report ※ rules-gate

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
      ({ base, old, oxlint, rule }) =>
        old === 'on' && oxlint.startsWith('native') && base === 'off' && !deliberate.has(rule),
    )
    .map(({ rule }) => rule);
  expect(dropped, `on in @jlg/eslint, native in oxlint, off here: ${dropped.join(', ')}`).toEqual(
    [],
  );
  expect(
    rows
      .map(({ base, category, old, options, oxlint, rule }) =>
        [rule, category, old, oxlint, base, options].join(' | '),
      )
      .toSorted(),
  ).toMatchSnapshot();
});

test('options', () => {
  /** @type {Record<string, string>} */
  const verdicts = {
    'eslint/id-length': 'same',
    'eslint/new-cap': 'differs: off defaults',
    'eslint/no-unused-vars': 'same',
    'eslint/radix': 'unverified: no declared defaults',
    'eslint/sort-imports': 'same',
    'react/require-default-props': 'differs: old sets none',
    'typescript/naming-convention': 'same',
    'typescript/no-magic-numbers': '-',
    'unicorn/consistent-json-file-read': 'none',
    'unicorn/expiring-todo-comments': 'unverified: schema drift: ignoreDatesOnPullRequests',
    'unicorn/prefer-export-from': 'unverified: schema drift: ignoreUsedVariables',
    'unicorn/prefer-number-properties': 'differs: off defaults',
  };
  expect(
    Object.fromEntries(
      rows
        .filter(({ rule }) => Object.hasOwn(verdicts, rule))
        .map(({ options, reason, rule }) => [rule, [options, reason].filter(Boolean).join(': ')]),
    ),
  ).toEqual(verdicts);
});

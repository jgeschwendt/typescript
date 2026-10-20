import { expect, test } from 'bun:test';
import { rows } from './rules.js';

// <rule> | <category> | <old> | <oxlint> | <base> | <options>[: <reason>]; categories run at error, so a bump's new rules diff here; regenerate: bun test --update-snapshots, then bun run report ※ rules-gate

/** on in @jlg/eslint and native in oxlint, off here by choice; nursery runs at warn, so only the non-nursery offs remain: one blanket component style, and no-continue against unicorn/prefer-continue */
const deliberate = new Set(['eslint/no-continue', 'react/function-component-definition']);

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
      .map(({ base, category, old, options, oxlint, reason, rule }) =>
        [rule, category, old, oxlint, base, [options, reason].filter(Boolean).join(': ')].join(
          ' | ',
        ),
      )
      .toSorted(),
  ).toMatchSnapshot();
});

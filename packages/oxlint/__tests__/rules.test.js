import { expect, test } from 'bun:test';
import { rows } from './rules.js';

// <rule> | <category> | <oxlint> | <base> | <options>; categories run at error, so a bump's new rules diff here; regenerate: bun test --update-snapshots, then bun run report ※ rules-gate

test('rules', () => {
  expect(
    rows
      .map(({ base, category, options, oxlint, rule }) =>
        [rule, category, oxlint, base, options].join(' | '),
      )
      .toSorted(),
  ).toMatchSnapshot();
});

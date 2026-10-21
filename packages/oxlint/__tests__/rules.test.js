import { expect, test } from 'bun:test';
import { config, off, ruleKey } from './_helpers.js';
import { rows } from './rules.js';

// <rule> | <category> | <oxlint> | <base> | <options> | <reason>; categories run at error, so a bump's new rules diff here; regenerate: bun test --update-snapshots, then bun run report ※ rules-gate

test('rules', () => {
  expect(
    rows
      .map(({ base, category, options, oxlint, reason, rule }) =>
        [rule, category, oxlint, base, options, reason].join(' | '),
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
        : !oxlint.get(ruleKey(key))?.startsWith('native'),
    ),
  ).toEqual([]);
});

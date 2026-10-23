import { expect, test } from 'bun:test';
import plugin from './divider.js';

const lint = (text, column = 0) => {
  const reports = [];
  const comment = { loc: { start: { column } }, type: 'Line', value: text.slice(2) };
  const { Program: run } = plugin.rules.divider.create({
    report: (report) => {
      reports.push(report);
    },
    sourceCode: { getAllComments: () => [comment] },
  });
  run();
  return reports.map(({ fix, message }) => [
    message,
    fix?.({ replaceText: (_, value) => value }).length,
  ]);
};

test('a divider ends at column 100, fixed by its run of rules', () => {
  expect(lint(`// ─── issues ${'─'.repeat(86)}`)).toEqual([]);
  expect(lint('// ─── issues ───')).toEqual([['a divider ends at column 100', 100]]);
  expect(lint(`// ─── issues ${'─'.repeat(90)}`, 2)).toEqual([
    ['a divider ends at column 100', 98],
  ]);
  expect(lint(`// ─── ${'x'.repeat(92)} ─`)).toEqual([
    ['divider title too long for 100 columns', undefined],
  ]);
  expect(lint('// prose ───')).toEqual([]);
});

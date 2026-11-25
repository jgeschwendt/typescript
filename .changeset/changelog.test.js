import { expect, mock, test } from 'bun:test';

const commit = 'ccf323a8410e511d713928e52fe70a6ba36cdefa';
const commitLink = `[\`ccf323a\`](https://github.com/jgeschwendt/typescript/commit/${commit})`;
const pullLink = '[#96](https://github.com/jgeschwendt/typescript/pull/96)';
const options = { repo: 'jgeschwendt/typescript' };

// a commit the network never sees: `orphan` has no PR, any other sha has #96
void mock.module('@changesets/get-github-info', () => ({
  getCommitInfo: ({ commit: sha }) => ({
    commit: { markdownLink: commitLink },
    pull: sha === 'orphan' ? undefined : { markdownLink: pullLink },
  }),
}));

const { getDependencyReleaseLine, getReleaseLine, strip } = await import('./changelog.js');

test('release line: commit, summary, then PR', async () => {
  expect(await getReleaseLine({ commit, summary: 'message\n' }, 'patch', options)).toBe(
    `- ${commitLink} message (${pullLink})`,
  );
});

test('release line drops what GitHub does not know', async () => {
  expect(await getReleaseLine({ commit: 'orphan', summary: 'message' }, 'patch', options)).toBe(
    `- ${commitLink} message`,
  );
  expect(await getReleaseLine({ summary: 'message' }, 'patch', options)).toBe('- message');
});

test('later summary lines indent under the bullet; blank lines stay blank', async () => {
  expect(await getReleaseLine({ summary: 'first\n\nsecond\nthird' }, 'minor', options)).toBe(
    '- first\n\n  second\n  third',
  );
});

test('dependency line names each updated package, or nothing', () => {
  expect(getDependencyReleaseLine([], [])).toBe('');
  // changesets' shape, parsed: its key trips no-keyword-prefix
  const dependencies = JSON.parse(
    '[{"name":"@jlg/oxfmt","newVersion":"0.1.3"},{"name":"verax","newVersion":"0.1.2"}]',
  );
  expect(getDependencyReleaseLine([], dependencies)).toBe(
    '- Updated dependencies: `@jlg/oxfmt@0.1.3`, `verax@0.1.2`',
  );
});

test('strip removes every type heading and the blank line after it', async () => {
  const file = `${process.env.TMPDIR ?? '/tmp'}/changelog-${crypto.randomUUID()}.md`;
  await Bun.write(
    file,
    '# x\n\n## 0.2.0\n\n### Minor Changes\n\n- a\n\n### Patch Changes\n\n- b\n',
  );
  await strip([file]);
  expect(await Bun.file(file).text()).toBe('# x\n\n## 0.2.0\n\n- a\n\n- b\n');
  await Bun.file(file).delete();
});

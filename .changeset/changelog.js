// changesets' changelog functions; run by bun, it strips the `### … Changes` headings changesets hardcodes
import { getCommitInfo } from '@changesets/get-github-info';

const getDependencyReleaseLine = (_changesets, dependencies) =>
  dependencies.length === 0
    ? ''
    : `- Updated dependencies: ${dependencies.map((dependency) => `\`${dependency.name}@${dependency.newVersion}\``).join(', ')}`;

/**
Later summary lines indent under the bullet, so the entry stays one list item.
*/
const getReleaseLine = async ({ commit, summary }, _type, { repo }) => {
  const info = commit && (await getCommitInfo({ commit, repo }));
  return `- ${[info?.commit.markdownLink, summary.trim().replaceAll(/\n(?=.)/gu, '\n  '), info?.pull && `(${info.pull.markdownLink})`].filter(Boolean).join(' ')}`;
};

/**
Run as a CLI it strips its arguments; imported (by changesets under node, or a test) it strips nothing.
*/
const strip = (files = import.meta.main ? Bun.argv.slice(2) : []) =>
  Promise.all(
    files.map(async (file) => {
      const text = await Bun.file(file).text();
      return Bun.write(file, text.replaceAll(/^### (?:Major|Minor|Patch) Changes\n\n/gmu, ''));
    }),
  );

await strip();

export { getDependencyReleaseLine, getReleaseLine, strip };

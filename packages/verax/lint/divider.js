/**
`// ─── title ───…` section dividers end at column 100, oxfmt's width
*/
const WIDTH = 100;
const divider = /^ ─── (?<title>.+?) ─+$/u;

const plugin = {
  meta: { name: 'verax' },
  rules: {
    divider: {
      create: (context) => ({
        Program() {
          for (const comment of context.sourceCode.getAllComments()) {
            const title = comment.type === 'Line' && divider.exec(comment.value)?.groups.title;
            const { column } = comment.loc.start;
            if (!title || column + 2 + comment.value.length === WIDTH) {
              continue;
            }
            const head = ` ─── ${title} `;
            const run = WIDTH - column - 2 - head.length;
            context.report({
              fix:
                run < 3
                  ? undefined
                  : (fixer) => fixer.replaceText(comment, `//${head}${'─'.repeat(run)}`),
              loc: comment.loc,
              message:
                run < 3
                  ? `divider title too long for ${WIDTH} columns`
                  : `a divider ends at column ${WIDTH}`,
            });
          }
        },
      }),
      meta: { fixable: 'code' },
    },
  },
};

export default plugin;

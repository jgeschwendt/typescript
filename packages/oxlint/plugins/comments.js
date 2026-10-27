/** `// ─── title ───…`: a section divider; comments are the one thing oxfmt never wraps */
const divider = /^ ─── (?<title>.+?) ─+$/u;

/** the fewest rules a divider closes on */
const least = 3;

/** oxfmt's default printWidth: defineConfig passes the consumer's */
const printWidth = 100;

const plugin = {
  meta: { name: 'comments' },
  rules: {
    divider: {
      create: (context) => ({
        Program() {
          const [{ width }] = context.options;
          for (const comment of context.sourceCode.getAllComments()) {
            const title = comment.type === 'Line' && divider.exec(comment.value)?.groups.title;
            const { column } = comment.loc.start;
            if (!title || column + 2 + comment.value.length === width) {
              continue;
            }
            const head = `// ─── ${title} `;
            const run = width - column - head.length;
            context.report({
              data: { width },
              loc: comment.loc,
              ...(run < least
                ? { messageId: 'long' }
                : {
                    fix: (fixer) => fixer.replaceText(comment, `${head}${'─'.repeat(run)}`),
                    messageId: 'width',
                  }),
            });
          }
        },
      }),
      meta: {
        defaultOptions: [{ width: printWidth }],
        docs: { description: 'Require `// ─── title ───` section dividers to end at the width' },
        fixable: 'code',
        messages: {
          long: 'Divider title too long for {{width}} columns.',
          width: 'A divider ends at column {{width}}.',
        },
        schema: [
          {
            additionalProperties: false,
            properties: { width: { minimum: 1, type: 'integer' } },
            type: 'object',
          },
        ],
        type: 'layout',
      },
    },
  },
};

export default plugin;

/** line or block: the disable/enable family and eslint-env */
const anyComment =
  /^\s*(?<prefix>eslint|oxlint)-(?<kind>disable|disable-line|disable-next-line|enable|env)(?:\s|$)/u;

/** block only, as ESLint reads them: inline rule config and global declarations */
const blockComment = /^\s*(?:eslint|exported|globals?|oxlint)(?:\s|$)/u;

const name = 'inline-config';

/** a line `// oxlint-disable` starts after its own line, so only a block one covers itself; rules read up to any `-- description` */
const selfSuppressing = (comment, { groups: { kind, prefix } }) => {
  if (kind !== 'disable-line' && (kind !== 'disable' || comment.type !== 'Block')) {
    return false;
  }
  const directive = `${prefix}-${kind}`;
  const named = comment.value
    .slice(comment.value.indexOf(directive) + directive.length)
    .split('--', 1)[0]
    .split(/[\s,]+/u)
    .filter(Boolean);
  return named.length === 0 || named.some((rule) => rule.startsWith(`${name}/`));
};

const plugin = {
  meta: { name },
  rules: {
    'no-directives': {
      create: (context) => ({
        Program() {
          for (const comment of context.sourceCode.getAllComments()) {
            const match = anyComment.exec(comment.value);
            if (match !== null && selfSuppressing(comment, match)) {
              const { line } = comment.loc.start;
              throw new Error(
                `${name}/no-directives: ${context.filename}:${line} carries a directive that would suppress its own report; inline linter directives are not allowed — change the config instead.`,
              );
            }
            if (match !== null || (comment.type === 'Block' && blockComment.test(comment.value))) {
              context.report({ loc: comment.loc, messageId: 'banned' });
            }
          }
        },
      }),
      meta: {
        docs: {
          description:
            'Disallow inline linter directives (disable, enable, env, rule config, globals)',
        },
        messages: {
          banned: 'Inline linter directives are not allowed; change the config instead.',
        },
        schema: [],
        type: 'problem',
      },
    },
  },
};

export default plugin;

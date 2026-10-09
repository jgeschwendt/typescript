// Bans inline linter directives — the oxlint stand-in for @jlg/eslint's
// `linterOptions.noInlineConfig: true`, which oxlint has no setting for
// (`options.respectEslintDisableDirectives: false` covers only `eslint-*`
// comments, never `oxlint-*`). Reports every comment ESLint or oxlint would
// read as configuration: disable/enable in all four forms, eslint-env, inline
// rule config and the global/exported declarations.
//
// A report is filtered through the same directives it reports, so a directive
// whose range covers its own comment — a blanket or self-naming block
// `disable`, or `disable-line` — would silence its own report. Those throw
// instead: oxlint fails the run with "Error running JS plugin", which no
// comment can suppress. (verified 2026-10-09 · probe, oxlint 1.87: a reported
// `/* oxlint-disable */` and `// oxlint-disable-line` came back empty)

/** Line or block comments: the disable/enable family and eslint-env. */
const anyComment =
  /^\s*(?<prefix>eslint|oxlint)-(?<kind>disable|disable-line|disable-next-line|enable|env)(?:\s|$)/u;

/**
 * Block comments only, as ESLint reads them: inline rule config (an `eslint`
 * comment naming rule severities) and global declarations.
 */
const blockComment = /^\s*(?:eslint|exported|globals?|oxlint)(?:\s|$)/u;

const name = 'inline-config';

/** The rules a disable directive names, without its `-- description`. */
const targets = (value, directive) =>
  value
    .slice(value.indexOf(directive) + directive.length)
    .split('--')[0]
    .split(/[\s,]+/u)
    .filter(Boolean);

/**
 * A directive whose suppression range includes the comment itself: a block
 * `disable` (a line `// oxlint-disable` starts after its own line) or a
 * `disable-line`, blanket or naming this plugin.
 */
const selfSuppressing = (comment, match) => {
  const { kind, prefix } = match.groups;
  const covers =
    kind === 'disable-line' || (kind === 'disable' && comment.type === 'Block');
  if (!covers) {
    return false;
  }
  const named = targets(comment.value, `${prefix}-${kind}`);
  return (
    named.length === 0 || named.some((rule) => rule.startsWith(`${name}/`))
  );
};

const plugin = {
  meta: { name },
  rules: {
    'no-directives': {
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              const match = anyComment.exec(comment.value);
              if (match !== null && selfSuppressing(comment, match)) {
                const { line } = comment.loc.start;
                throw new Error(
                  `${name}/no-directives: ${context.filename}:${line} carries a directive that would suppress its own report; inline linter directives are not allowed — change the config instead.`,
                );
              }
              if (
                match !== null ||
                (comment.type === 'Block' && blockComment.test(comment.value))
              ) {
                context.report({ loc: comment.loc, messageId: 'banned' });
              }
            }
          },
        };
      },
      meta: {
        docs: {
          description:
            'Disallow inline linter directives (disable, enable, env, rule config, globals)',
        },
        messages: {
          banned:
            'Inline linter directives are not allowed; change the config instead.',
        },
        schema: [],
        type: 'problem',
      },
    },
  },
};

export default plugin;

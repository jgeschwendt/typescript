/** a type literal that is the one type argument of `Readonly<…>` */
const isReadonlyArgument = ({ parent }) =>
  parent.type === 'TSTypeParameterInstantiation' &&
  parent.params.length === 1 &&
  parent.parent.typeName?.name === 'Readonly';

/** inside `Readonly<…>` every modifier is redundant; outside, a method or call signature the generic would drop or change keeps a literal mixed */
const messageId = (node) =>
  (isReadonlyArgument(node) && 'redundant') ||
  (node.members.every((member) => member.readonly) ? 'generic' : 'mixed');

/** a fixable literal's edits: each modifier and the whitespace after it out, the generic around it unless already there */
const edits = (fixer, text, node) => [
  ...node.members
    .filter((member) => member.readonly)
    .map(({ range }) =>
      fixer.removeRange([
        range[0],
        range[0] + /^readonly\s*/u.exec(text.slice(range[0]))[0].length,
      ]),
    ),
  ...(isReadonlyArgument(node)
    ? []
    : [fixer.insertTextBefore(node, 'Readonly<'), fixer.insertTextAfter(node, '>')]),
];

const plugin = {
  meta: { name: 'types' },
  rules: {
    'prefer-readonly-generic': {
      create: (context) => {
        const marked = [];
        return {
          // one fix rewrites the outermost fixable literal's whole subtree: oxlint drops a fix that overlaps another
          'Program:exit'() {
            const fixable = marked.filter((node) => messageId(node) !== 'mixed');
            const root = (node) =>
              fixable.find(
                (outer) => outer.range[0] <= node.range[0] && node.range[1] <= outer.range[1],
              );
            for (const node of marked) {
              const id = messageId(node);
              // a stray modifier is its own finding; a literal to wrap is one, at its first modifier
              const reported = node.members
                .filter((member) => member.readonly)
                .slice(0, id === 'redundant' ? Infinity : 1);
              for (const member of reported) {
                context.report({
                  messageId: id,
                  node: member,
                  ...(id !== 'mixed' && {
                    fix: (fixer) =>
                      fixable
                        .filter((each) => root(each) === root(node))
                        .flatMap((each) => edits(fixer, context.sourceCode.text, each)),
                  }),
                });
              }
            }
          },
          TSTypeLiteral(node) {
            if (node.members.some((member) => member.readonly)) {
              marked.push(node);
            }
          },
        };
      },
      meta: {
        docs: {
          description: 'Require `Readonly<{ … }>` over per-member `readonly` in a type literal',
        },
        fixable: 'code',
        messages: {
          generic: 'A readonly object type is `Readonly<{ … }>`, not per-member `readonly`.',
          mixed:
            'Only some members are `readonly`: wrap the whole literal in `Readonly<{ … }>` or split the type.',
          redundant: '`readonly` is redundant inside `Readonly<{ … }>`.',
        },
        schema: [],
        type: 'suggestion',
      },
    },
  },
};

export default plugin;

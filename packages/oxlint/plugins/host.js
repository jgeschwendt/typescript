/** ESLint 9.39 SourceCode#getJSDocComment, `this` made a parameter and its checks respelled */
const jsdoc = (sourceCode, node) => {
  const find = (astNode) => {
    const before = sourceCode.getTokenBefore(astNode, { includeComments: true });
    return before?.type === 'Block' &&
      before.value.startsWith('*') &&
      astNode.loc.start.line - before.loc.end.line <= 1
      ? before
      : null;
  };
  let { parent } = node;
  switch (node.type) {
    case 'ClassDeclaration':
    case 'FunctionDeclaration': {
      return find(parent.type.startsWith('Export') ? parent : node);
    }
    case 'ClassExpression': {
      return find(parent.parent);
    }
    case 'ArrowFunctionExpression':
    case 'FunctionExpression': {
      if (parent.type !== 'CallExpression' && parent.type !== 'NewExpression') {
        while (
          parent &&
          sourceCode.getCommentsBefore(parent).length === 0 &&
          !/Function/u.test(parent.type) &&
          parent.type !== 'MethodDefinition' &&
          parent.type !== 'Property'
        ) {
          ({ parent } = parent);
        }
        if (parent && parent.type !== 'FunctionDeclaration' && parent.type !== 'Program') {
          return find(parent);
        }
      }
      return find(node);
    }
    default: {
      return null;
    }
  }
};

/** after a throw reports once, the rule is silent for the rest of the file */
const adapt = (rule, extend) => ({
  ...rule,
  create(context) {
    // oxlint defines these as getters, so assignment throws; a literal's descriptors are configurable, so a context Proxy (unicorn wrapping no-warning-comments) can override them
    const sourceCode = Object.create(
      context.sourceCode,
      Object.getOwnPropertyDescriptors({ getJSDocComment: (node) => jsdoc(sourceCode, node) }),
    );
    const local = Object.create(
      context,
      Object.getOwnPropertyDescriptors({
        ...extend?.(context),
        getSourceCode: () => sourceCode,
        sourceCode,
      }),
    );
    let hasCrashed = false;
    return Object.fromEntries(
      Object.entries(rule.create(local)).map(([selector, listener]) => [
        selector,
        (...listenerArguments) => {
          if (hasCrashed) {
            return;
          }
          try {
            listener(...listenerArguments);
          } catch (error) {
            hasCrashed = true;
            local.report({
              loc: listenerArguments[0].loc ?? { column: 0, line: 1 },
              message: `Rule crashed under oxlint's JS plugin host: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        },
      ]),
    );
  },
});

/** extend(context) returns extra properties for each file's context */
export const host = (plugin, name, extend) => ({
  meta: { name },
  rules: Object.fromEntries(
    Object.entries(plugin.rules).map(([id, rule]) => [id, adapt(rule, extend)]),
  ),
});

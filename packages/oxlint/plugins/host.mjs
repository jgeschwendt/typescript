// Adapts ESLint plugins to oxlint's JS plugin host where the two differ in
// ways a rule can feel. Not a plugin itself: the -js plugins wrap their rules
// with `host`.
//
//  - oxlint hands every file the SAME context and sourceCode objects, so a
//    cache keyed by them — eslint-plugin-react's memoized `@jsx` pragma,
//    eslint-module-utils' once-per-file resolve errors — leaks from the first
//    file a thread lints into every later one. Each file gets a fresh context.
//  - oxlint's `sourceCode.getJSDocComment` throws ("not supported at present
//    (and deprecated)"). ESLint core's no-invalid-this reads it for `@this`
//    tags, eslint-plugin-react for `@extends React.Component`; ESLint's own
//    implementation is restored below.
//  - One throwing listener aborts every JS plugin on that file ("Error running
//    JS plugin"), dropping the other rules' reports with it. A throw is
//    reported as a diagnostic of the rule that threw instead.
// (verified 2026-10-09 · probe, oxlint 1.87)

/** The export nodes ESLint's `looksLikeExport` matches. */
const exported = new Set([
  'ExportAllDeclaration',
  'ExportDefaultDeclaration',
  'ExportNamedDeclaration',
  'ExportSpecifier',
]);

/**
 * ESLint 9.39 SourceCode#getJSDocComment
 * (lib/languages/js/source-code/source-code.js), unchanged but for `this`.
 */
const jsdoc = (sourceCode, node) => {
  const find = (astNode) => {
    const before = sourceCode.getTokenBefore(astNode, {
      includeComments: true,
    });
    return before !== null &&
      before !== undefined &&
      before.type === 'Block' &&
      before.value.startsWith('*') &&
      astNode.loc.start.line - before.loc.end.line <= 1
      ? before
      : null;
  };
  let { parent } = node;
  switch (node.type) {
    case 'ClassDeclaration':
    case 'FunctionDeclaration': {
      return find(exported.has(parent.type) ? parent : node);
    }
    case 'ClassExpression': {
      return find(parent.parent);
    }
    case 'ArrowFunctionExpression':
    case 'FunctionExpression': {
      if (parent.type !== 'CallExpression' && parent.type !== 'NewExpression') {
        while (
          sourceCode.getCommentsBefore(parent).length === 0 &&
          !/Function/u.test(parent.type) &&
          parent.type !== 'MethodDefinition' &&
          parent.type !== 'Property'
        ) {
          ({ parent } = parent);
          if (!parent) {
            break;
          }
        }
        if (
          parent &&
          parent.type !== 'FunctionDeclaration' &&
          parent.type !== 'Program'
        ) {
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

/**
 * A property descriptor, configurable unlike oxlint's own context properties:
 * a rule's Proxy over the context (unicorn's expiring-todo-comments wraps
 * ESLint's no-warning-comments) may return a different value for it.
 */
const own = (value) => ({ configurable: true, value, writable: true });

/**
 * One rule, given a fresh context and sourceCode per file; a listener that
 * throws reports it once and the rule stops running on that file.
 */
const adapt = (rule, extend) => ({
  ...rule,
  create(context) {
    const sourceCode = Object.create(context.sourceCode, {
      getJSDocComment: own((node) => jsdoc(sourceCode, node)),
    });
    const extra = Object.entries(extend?.(context) ?? {});
    const local = Object.create(context, {
      ...Object.fromEntries(extra.map(([key, value]) => [key, own(value)])),
      getSourceCode: own(() => sourceCode),
      sourceCode: own(sourceCode),
    });
    let crashed = false;
    const contain =
      (listener) =>
      (...listenerArguments) => {
        if (crashed) {
          return;
        }
        try {
          listener(...listenerArguments);
        } catch (error) {
          crashed = true;
          const [node] = listenerArguments;
          local.report({
            loc:
              node !== null && typeof node === 'object' && 'loc' in node
                ? node.loc
                : { column: 0, line: 1 },
            message: `Rule crashed under oxlint's JS plugin host: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      };
    return Object.fromEntries(
      Object.entries(rule.create(local)).map(([selector, listener]) => [
        selector,
        contain(listener),
      ]),
    );
  },
});

/**
 * Wraps every rule of an ESLint plugin for oxlint's JS plugin host. `extend`
 * returns extra properties for a file's context.
 */
export const host = (plugin, name, extend) => ({
  meta: { ...plugin.meta, name },
  rules: Object.fromEntries(
    Object.entries(plugin.rules).map(([id, rule]) => [id, adapt(rule, extend)]),
  ),
});

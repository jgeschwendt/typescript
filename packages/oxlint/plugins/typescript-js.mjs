import { host } from './host.mjs';
import './typescript6.mjs';

// dynamic: a static import evaluates the plugin's CommonJS before ./typescript6.mjs patches the resolver on bun
const { default: plugin } = await import('@typescript-eslint/eslint-plugin');

/** oxlint has no parser services; naming-convention needs them only for types, so stub them */
const untyped = (rule) => ({
  ...rule,
  create(context) {
    if (
      context.options.some(
        (option) => option !== null && typeof option === 'object' && 'types' in option,
      )
    ) {
      throw new Error(
        'typescript-js/naming-convention: the `types` option needs type information, which oxlint JS plugins cannot provide',
      );
    }
    // not a Proxy: oxlint's parserServices is a non-configurable data property
    const sourceCode = Object.create(context.sourceCode, {
      parserServices: {
        value: { esTreeNodeToTSNodeMap: new WeakMap(), tsNodeToESTreeNodeMap: new WeakMap() },
      },
    });
    return rule.create(Object.create(context, { sourceCode: { value: sourceCode } }));
  },
});

export default host(
  {
    rules: { ...plugin.rules, 'naming-convention': untyped(plugin.rules['naming-convention']) },
  },
  'typescript-js',
);

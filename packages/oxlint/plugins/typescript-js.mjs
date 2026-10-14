import { host } from './host.mjs';
import './typescript6.mjs';

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
    const parserServices = {
      esTreeNodeToTSNodeMap: new WeakMap(),
      tsNodeToESTreeNodeMap: new WeakMap(),
    };
    // not a Proxy: oxlint's parserServices is a non-configurable data property
    const sourceCode = Object.create(context.sourceCode, {
      parserServices: { value: parserServices },
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

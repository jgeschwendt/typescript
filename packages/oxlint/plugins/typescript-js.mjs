// typescript-eslint rules oxlint has no native port of (GAPS.md), run unchanged
// through oxlint's `jsPlugins`.
import { host } from './host.mjs';
import './typescript6.mjs';

const { default: plugin } = await import('@typescript-eslint/eslint-plugin');

// naming-convention reads parser services at startup but uses the type checker
// only for its `types` option, which this base never sets. oxlint provides no
// parser services, so hand the rule the empty maps it checks for and no program
// (`getParserServices(context, true)` accepts that). The rule is otherwise
// untouched; a `types` option fails loudly instead of crashing on a missing
// program mid-lint.
const untyped = (rule) => ({
  ...rule,
  create(context) {
    if (
      context.options.some(
        (option) =>
          option !== null && typeof option === 'object' && 'types' in option,
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
    // Object.create, not a Proxy: oxlint's `parserServices` is a non-configurable
    // data property, which a Proxy `get` trap may not override.
    const sourceCode = Object.create(context.sourceCode, {
      parserServices: { value: parserServices },
    });
    return rule.create(
      Object.create(context, { sourceCode: { value: sourceCode } }),
    );
  },
});

export default host(
  {
    rules: {
      'member-ordering': plugin.rules['member-ordering'],
      'naming-convention': untyped(plugin.rules['naming-convention']),
    },
  },
  'typescript-js',
);

import { host } from './host.js';
import './typescript6.js';

// dynamic: a static import evaluates the plugin's CommonJS before ./typescript6.js patches the resolver on bun
const { default: plugin } = await import('@typescript-eslint/eslint-plugin');

/** oxlint has no parser services; naming-convention needs them only for types, so stub them */
const untyped = (rule) => ({
  ...rule,
  create(context) {
    if (context.options.some((option) => option.types !== undefined)) {
      throw new Error(
        'typescript-js/naming-convention: the `types` option needs type information, which oxlint JS plugins cannot provide',
      );
    }
    // host.js gives each file its own sourceCode, so the stub never leaks across files
    Object.defineProperty(context.sourceCode, 'parserServices', {
      value: { esTreeNodeToTSNodeMap: new WeakMap(), tsNodeToESTreeNodeMap: new WeakMap() },
    });
    return rule.create(context);
  },
});

// descriptors, not a spread: typescript-eslint's rules are getters that load a rule module each
export default host(
  {
    rules: Object.defineProperties(
      {},
      {
        ...Object.getOwnPropertyDescriptors(plugin.rules),
        'naming-convention': {
          enumerable: true,
          get: () => untyped(plugin.rules['naming-convention']),
        },
      },
    ),
  },
  'typescript-js',
);

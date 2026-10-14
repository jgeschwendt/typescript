// @ts-check

/** @typedef {import('oxlint').OxlintConfig} Config */
/** @typedef {import('oxlint').OxlintOverride} Override */
/** @typedef {{ next: boolean; react: boolean; typescript: boolean }} Env */

const { fileURLToPath } = process.getBuiltinModule('node:url');

// ※ oxlint-tsgolint-pairing

// replaces oxlint's default plugin set: an unlisted plugin's rules silently never run
/** @type {NonNullable<Config['plugins']>} */
const plugins = ['eslint', 'import', 'oxc', 'react', 'typescript', 'unicorn'];

/**
 * jsPlugins resolve against their config file, and this base has none
 * @param {string} specifier
 */
const absolute = (specifier) => fileURLToPath(new URL(specifier, import.meta.url));

// ※ oxlint-js-plugins
const jsPlugins = [
  { name: 'import-js', specifier: absolute('./plugins/import-js.mjs') },
  { name: 'react-js', specifier: absolute('./plugins/react-js.mjs') },
  { name: 'unicorn-js', specifier: absolute('./plugins/unicorn-js.mjs') },
  absolute('./plugins/eslint-js.mjs'),
  absolute('./plugins/inline-config.mjs'),
  absolute('./plugins/typescript-js.mjs'),
];

// ※ oxlint-peer-coupling
/** @type {NonNullable<Config['categories']>} */
const categories = {
  correctness: 'error',
  nursery: 'off',
  pedantic: 'error',
  perf: 'error',
  restriction: 'warn',
  style: 'error',
  suspicious: 'error',
};

// ※ oxlint-base
/** @type {NonNullable<Config['rules']>} */
const rules = {
  'oxc/no-optional-chaining': 'off',
  'oxc/no-rest-spread-properties': 'off',

  'no-magic-numbers': [
    'warn',
    {
      detectObjects: true,
      enforceConst: true,
      ignore: [-1, 0, 1, 2],
      ignoreArrayIndexes: false,
      ignoreClassFieldInitialValues: false,
      ignoreDefaultValues: false,
      ignoreEnums: true,
      ignoreNumericLiteralTypes: true,
      ignoreReadonlyClassProperties: false,
      ignoreTypeIndexes: false,
    },
  ],
  // ESLint 9's defaults: any options object drops oxlint's own ^_ ignore patterns
  'no-unused-vars': [
    'error',
    {
      args: 'after-used',
      caughtErrors: 'all',
      ignoreRestSiblings: false,
      reportVarsOnlyUsedAsTypes: true,
      vars: 'all',
    },
  ],
  'no-void': ['error', { allowAsStatement: true }],
  'one-var': ['error', 'never'],
  'sort-imports': ['error', { ignoreDeclarationSort: true }],

  'id-length': ['error', { checkGeneric: false }],
  'no-inner-declarations': ['error', 'functions', { blockScopedFunctions: 'allow' }],
  'no-irregular-whitespace': [
    'error',
    {
      skipComments: false,
      skipJSXText: false,
      skipRegExps: false,
      skipStrings: true,
      skipTemplates: false,
    },
  ],
  'no-shadow-restricted-names': ['error', { reportGlobalThis: false }],

  'capitalized-comments': 'off',
  'max-lines': 'off',
  'max-lines-per-function': 'off',
  'no-ternary': 'off',
  'no-undefined': 'off',

  curly: 'off',
  'no-unexpected-multiline': 'off',
  'unicorn/empty-brace-spaces': 'off',
  'unicorn/no-nested-ternary': 'off',
  'unicorn/number-literal-case': 'off',

  'import/no-default-export': 'error',
  'import/no-named-export': 'off',
  'import/prefer-default-export': 'off',

  'react/function-component-definition': 'off',
  'react/jsx-curly-brace-presence': [
    'error',
    { children: 'always', propElementValues: 'always', props: 'never' },
  ],
  'react/react-in-jsx-scope': 'off',

  'typescript/prefer-readonly-parameter-types': 'warn',

  // deprecated upstream: each double-reports with its successor
  'typescript/ban-types': 'off',
  'typescript/no-empty-interface': 'off',
  'typescript/no-var-requires': 'off',
  'typescript/prefer-ts-expect-error': 'off',

  'eslint-js/camelcase': 'error',
  'eslint-js/consistent-this': 'error',
  'eslint-js/no-restricted-syntax': 'error',
  'eslint-js/no-undef-init': 'error',
  'eslint-js/require-atomic-updates': 'error',
  'import-js/no-deprecated': 'error',
  'import-js/no-extraneous-dependencies': 'error',
  'import-js/no-import-module-exports': 'error',
  'import-js/no-internal-modules': 'error',
  'import-js/no-relative-packages': 'error',
  'import-js/no-restricted-paths': 'error',
  'import-js/no-useless-path-segments': 'error',
  'import-js/order': [
    'error',
    {
      alphabetize: { caseInsensitive: false, order: 'asc' },
      groups: [['builtin', 'external'], 'internal', 'index', 'sibling', 'parent'],
      pathGroups: [{ group: 'internal', pattern: '@/**' }],
    },
  ],
  'inline-config/no-directives': 'error',
  'react-js/boolean-prop-naming': 'error',
  'react-js/destructuring-assignment': 'error',
  'react-js/jsx-no-bind': 'error',
  'react-js/jsx-no-leaked-render': 'error',
  'react-js/jsx-sort-props': 'error',
  'react-js/no-adjacent-inline-elements': 'error',
  'react-js/no-deprecated': 'error',
  'react-js/no-invalid-html-attribute': 'error',
  'react-js/no-typos': 'error',
  'react-js/no-unused-prop-types': 'error',
  'react-js/prefer-read-only-props': 'error',
  'react-js/require-default-props': ['error', { functions: 'defaultArguments' }],
  'unicorn-js/consistent-destructuring': 'error',
  'unicorn-js/consistent-json-file-read': ['error', 'buffer'],
  'unicorn-js/expiring-todo-comments': ['error', { checkDates: true }],
  'unicorn-js/name-replacements': 'error',
  'unicorn-js/no-for-loop': 'error',
  'unicorn-js/no-keyword-prefix': 'error',
  'unicorn-js/no-named-default': 'error',
  'unicorn-js/no-unnecessary-polyfills': 'error',
  'unicorn-js/no-unused-properties': 'error',
  'unicorn-js/prefer-switch': 'error',
  'unicorn-js/string-content': 'error',
};

// oxlint cannot drop a plugin per override: every category-enabled typescript rule, by name
const typescriptOnly = [
  'adjacent-overload-signatures',
  'array-type',
  'await-thenable',
  'ban-ts-comment',
  'ban-tslint-comment',
  'class-literal-property-style',
  'consistent-generic-constructors',
  'consistent-indexed-object-style',
  'consistent-return',
  'consistent-type-assertions',
  'consistent-type-definitions',
  'consistent-type-exports',
  'consistent-type-imports',
  'dot-notation',
  'explicit-function-return-type',
  'explicit-member-accessibility',
  'explicit-module-boundary-types',
  'method-signature-style',
  'no-array-delete',
  'no-base-to-string',
  'no-confusing-non-null-assertion',
  'no-confusing-void-expression',
  'no-deprecated',
  'no-duplicate-enum-values',
  'no-duplicate-type-constituents',
  'no-dynamic-delete',
  'no-empty-object-type',
  'no-explicit-any',
  'no-extra-non-null-assertion',
  'no-extraneous-class',
  'no-floating-promises',
  'no-for-in-array',
  'no-generated-empty-object-type',
  'no-implied-eval',
  'no-import-type-side-effects',
  'no-inferrable-types',
  'no-invalid-void-type',
  'no-meaningless-void-operator',
  'no-misused-new',
  'no-misused-promises',
  'no-misused-spread',
  'no-mixed-enums',
  'no-namespace',
  'no-non-null-asserted-nullish-coalescing',
  'no-non-null-asserted-optional-chain',
  'no-non-null-assertion',
  'no-redundant-type-constituents',
  'no-require-imports',
  'no-restricted-types',
  'no-this-alias',
  'no-unnecessary-boolean-literal-compare',
  'no-unnecessary-parameter-property-assignment',
  'no-unnecessary-qualifier',
  'no-unnecessary-template-expression',
  'no-unnecessary-type-arguments',
  'no-unnecessary-type-assertion',
  'no-unnecessary-type-constraint',
  'no-unnecessary-type-conversion',
  'no-unnecessary-type-parameters',
  'no-unsafe-argument',
  'no-unsafe-assignment',
  'no-unsafe-call',
  'no-unsafe-declaration-merging',
  'no-unsafe-enum-comparison',
  'no-unsafe-function-type',
  'no-unsafe-member-access',
  'no-unsafe-return',
  'no-unsafe-type-assertion',
  'no-unsafe-unary-minus',
  'no-useless-default-assignment',
  'no-useless-empty-export',
  'no-wrapper-object-types',
  'non-nullable-type-assertion-style',
  'only-throw-error',
  'parameter-properties',
  'prefer-as-const',
  'prefer-enum-initializers',
  'prefer-find',
  'prefer-for-of',
  'prefer-function-type',
  'prefer-includes',
  'prefer-literal-enum-member',
  'prefer-namespace-keyword',
  'prefer-nullish-coalescing',
  'prefer-promise-reject-errors',
  'prefer-readonly',
  'prefer-readonly-parameter-types',
  'prefer-reduce-type-parameter',
  'prefer-regexp-exec',
  'prefer-return-this-type',
  'prefer-string-starts-ends-with',
  'promise-function-async',
  'related-getter-setter-pairs',
  'require-array-sort-compare',
  'require-await',
  'restrict-plus-operands',
  'restrict-template-expressions',
  'return-await',
  'strict-boolean-expressions',
  'strict-void-return',
  'switch-exhaustiveness-check',
  'triple-slash-reference',
  'unbound-method',
  'unified-signatures',
  'use-unknown-in-catch-callback-variable',
];

/** @type {Override[]} */
const always = [
  { env: { node: true }, files: ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'] },
  {
    files: ['**/*.{cjs,js,jsx,mjs}'],
    rules: {
      'eslint-js/no-invalid-this': 'error',
      'import-js/no-unresolved': 'error',
      ...Object.fromEntries(typescriptOnly.map((name) => [`typescript/${name}`, 'off'])),
    },
  },
];

const naming = {
  format: ['camelCase'],
  leadingUnderscore: 'forbid',
  selector: 'default',
  trailingUnderscore: 'forbid',
};
const parameter = { format: ['camelCase'], leadingUnderscore: 'allow', selector: 'parameter' };
const typeLike = { format: ['PascalCase'], selector: 'typeLike' };

// later overrides win: the .ts, .tsx, then route.ts naming-convention sets, in that order
/** @type {Override[]} */
const typescript = [
  {
    files: ['**/*.{cts,mts,ts,tsx}'],
    rules: {
      'import/consistent-type-specifier-style': 'off',
      'import/extensions': 'off',
      'no-implied-eval': 'off',
      'prefer-promise-reject-errors': 'off',
      'require-await': 'off',
      'typescript-js/member-ordering': 'error',
      'typescript-js/naming-convention': [
        'warn',
        naming,
        { format: ['PascalCase'], selector: 'enumMember' },
        { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralProperty' },
        parameter,
        typeLike,
        { format: ['camelCase', 'UPPER_CASE'], selector: 'variable' },
      ],
    },
  },
];

/** @type {Override[]} */
const react = [
  {
    files: ['**/*.tsx'],
    rules: {
      'typescript-js/naming-convention': [
        'warn',
        naming,
        { format: ['camelCase', 'PascalCase'], selector: 'function' },
        { format: ['camelCase', 'PascalCase'], selector: 'import' },
        { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralMethod' },
        { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralProperty' },
        parameter,
        typeLike,
        { format: ['camelCase', 'PascalCase'], selector: 'typeProperty' },
        { format: ['camelCase', 'PascalCase', 'UPPER_CASE'], selector: 'variable' },
      ],
    },
  },
];

/** @type {Override[]} */
const next = [
  {
    files: ['**/route.ts'],
    rules: {
      'typescript-js/naming-convention': [
        'warn',
        naming,
        { format: ['UPPER_CASE'], selector: 'function' },
        parameter,
        typeLike,
        { format: ['UPPER_CASE', 'camelCase'], selector: 'variable' },
      ],
    },
  },
  // segment files export reserved names (metadata, segment config) beside the component
  {
    files: ['**/{default,error,global-error,layout,loading,not-found,page,template}.{jsx,tsx}'],
    rules: {
      'react/only-export-components': [
        'warn',
        {
          allowExportNames: [
            'dynamic',
            'dynamicParams',
            'experimental_ppr',
            'fetchCache',
            'generateMetadata',
            'generateStaticParams',
            'generateViewport',
            'maxDuration',
            'metadata',
            'preferredRegion',
            'revalidate',
            'runtime',
            'viewport',
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/{layout,page,loading,not-found,error,global-error,template,default}.{jsx,tsx}',
      '**/mdx-components.{jsx,tsx}',
    ],
    rules: { 'unicorn/filename-case': ['error', { case: 'kebabCase' }] },
  },
  {
    files: ['**/{layout,page,middleware,instrumentation,robots,route}.{js,jsx,ts,tsx}'],
    rules: { 'import/no-default-export': 'off' },
  },
  {
    files: ['**/{instrumentation,middleware,route}.{js,ts}', '**/{layout,page}.{jsx,tsx}'],
    rules: { 'import/group-exports': 'off' },
  },
  {
    files: ['**/instrumentation.{js,ts}'],
    rules: { 'require-await': 'off', 'typescript/require-await': 'off' },
  },
];

/** @type {Override[]} */
const tooling = [
  {
    files: ['./{eslint,jest,next,oxfmt,oxlint,postcss}.config.{cjs,cts,js,mjs,mts,ts}'],
    rules: { 'import/no-default-export': 'off', 'import/no-named-export': 'error' },
  },
];

/** the nearest package.json from cwd decides; none found turns everything on */
const detectEnvironment = () => {
  const { existsSync, readFileSync } = process.getBuiltinModule('node:fs');
  const { dirname, join } = process.getBuiltinModule('node:path');
  for (let directory = process.cwd(); ; directory = dirname(directory)) {
    const file = join(directory, 'package.json');
    if (existsSync(file)) {
      const { dependencies, devDependencies } = JSON.parse(String(readFileSync(file)));
      const installed = { ...dependencies, ...devDependencies };
      return {
        next: 'next' in installed,
        react: 'react' in installed,
        typescript: 'typescript' in installed,
      };
    }
    if (dirname(directory) === directory) {
      return { next: true, react: true, typescript: true };
    }
  }
};

/** oxlint rejects version "detect"; without a semver eslint-plugin-react assumes latest */
const detectReact = () => {
  try {
    const { createRequire } = process.getBuiltinModule('node:module');
    const { version } = createRequire(`${process.cwd()}/package.json`)('react/package.json');
    const semver = /^\d+\.\d+\.\d+/u.exec(version);
    return semver === null ? {} : { react: { version: semver[0] } };
  } catch {
    return {};
  }
};

// ※ oxlint-extends-objects
/**
 * @param {Config & { env?: Config['env'] & Partial<Env> }} [config]
 * @returns {Config}
 */
const defineConfig = ({
  env: { next: isNext, react: isReact, typescript: isTypescript, ...environments } = {},
  ...config
} = {}) => {
  const detected = detectEnvironment();
  return {
    ...config,
    // oxlint's own env keys pass through; next/react/typescript are ours
    ...(Object.keys(environments).length > 0 && { env: environments }),
    categories: { ...categories, ...config.categories },
    jsPlugins: [...jsPlugins, ...(config.jsPlugins ?? [])],
    overrides: [
      ...always,
      ...((isTypescript ?? detected.typescript) ? typescript : []),
      ...((isReact ?? detected.react) ? react : []),
      ...((isNext ?? detected.next) ? next : []),
      ...tooling,
      ...(config.overrides ?? []),
    ],
    plugins: [...new Set([...plugins, ...(config.plugins ?? [])])],
    rules: { ...rules, ...config.rules },
    settings: { ...detectReact(), ...config.settings },
  };
};

export { defineConfig };

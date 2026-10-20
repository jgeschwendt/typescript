// @ts-check

/** @typedef {import('oxlint').OxlintConfig} Config */
/** @typedef {import('oxlint').OxlintOverride} Override */
/** @typedef {{ next: boolean; react: boolean; typescript: boolean }} Env */
/** @typedef {Record<string, { meta: { deprecated?: unknown; docs?: { extendsBaseRule?: boolean | string; requiresTypeChecking?: boolean } } }>} Rules */

const { existsSync, readFileSync } = process.getBuiltinModule('node:fs');
const { dirname, join } = process.getBuiltinModule('node:path');
const { fileURLToPath } = process.getBuiltinModule('node:url');

// ※ oxlint-tsgolint-pairing

// replaces oxlint's default plugin set: an unlisted plugin's rules silently never run
/** @type {NonNullable<Config['plugins']>} */
const plugins = ['eslint', 'import', 'oxc', 'react', 'typescript', 'unicorn'];

/**
jsPlugins resolve against their config file, and this base has none
@param {string} specifier
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
  restriction: 'error',
  style: 'error',
  suspicious: 'error',
};

// ※ oxlint-base
/** @type {NonNullable<Config['rules']>} */
const rules = {
  // oxc bans of syntax the house writes: async/await, ?., object rest/spread
  'oxc/no-async-await': 'off',
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
  // ES5 ended the octal reading of a leading 0, so a 10 says nothing; the real checks stay
  radix: ['error', 'as-needed'],
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
  'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
  'react/react-in-jsx-scope': 'off',

  'typescript/prefer-readonly-parameter-types': 'warn',

  // deprecated upstream: each double-reports with its successor
  'typescript/ban-types': 'off',
  'typescript/no-empty-interface': 'off',
  'typescript/no-var-requires': 'off',
  'typescript/prefer-ts-expect-error': 'off',

  'inline-config/no-directives': 'error',
};

// oxlint cannot drop a plugin per override: every category-enabled TypeScript rule, by name
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
    rules: Object.fromEntries(typescriptOnly.map((name) => [`typescript/${name}`, 'off'])),
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

/**
off, each for a fact: the JS-plugin rules oxlint lacks run unless named here
@type {Record<string, string>}
*/
// ※ opt-out-map
const disabled = {
  'import-js/enforce-node-protocol-usage':
    'duplicates native unicorn/prefer-node-protocol; without its required option it crashes: Missing option',
  'import-js/no-unused-modules':
    'inert without options; with unusedExports it fails every JS rule on the file: ESLint 10 exports no lib/util/glob-utils',
  'import-js/order': 'formatting-only: import order oxfmt sortImports owns',
  'react-js/jsx-child-element-spacing': 'formatting-only: whitespace and line breaks oxfmt owns',
  'react-js/jsx-closing-bracket-location': 'formatting-only: whitespace and line breaks oxfmt owns',
  'react-js/jsx-closing-tag-location': 'formatting-only: whitespace and line breaks oxfmt owns',
  'react-js/jsx-curly-newline': 'formatting-only: whitespace and line breaks oxfmt owns',
  'react-js/jsx-curly-spacing': 'formatting-only: whitespace and line breaks oxfmt owns',
  'react-js/jsx-equals-spacing': 'formatting-only: whitespace and line breaks oxfmt owns',
  'react-js/jsx-first-prop-new-line': 'formatting-only: whitespace and line breaks oxfmt owns',
  'react-js/jsx-indent':
    'formatting-only: 81 reports on oxfmt-clean jlg.io TSX (measured 2026-10-14)',
  'react-js/jsx-indent-props':
    'formatting-only: 45 reports on oxfmt-clean jlg.io TSX (measured 2026-10-14)',
  'react-js/jsx-max-props-per-line':
    'formatting-only: 6 reports on oxfmt-clean jlg.io TSX (measured 2026-10-14)',
  'react-js/jsx-newline':
    'formatting-only: 17 reports on oxfmt-clean jlg.io TSX (measured 2026-10-14)',
  'react-js/jsx-one-expression-per-line':
    'formatting-only: 9 reports on oxfmt-clean jlg.io TSX (measured 2026-10-14)',
  'react-js/jsx-props-no-multi-spaces':
    "crashes under the host: Cannot read properties of null (reading 'type')",
  'react-js/jsx-tag-spacing': 'formatting-only: whitespace and line breaks oxfmt owns',
  'react-js/jsx-uses-react':
    'reports nothing: marks JSX names used for no-unused-vars, native here',
  'react-js/jsx-uses-vars': 'reports nothing: marks JSX names used for no-unused-vars, native here',
  'react-js/jsx-wrap-multilines': 'formatting-only: whitespace and line breaks oxfmt owns',
  'typescript-js/class-methods-use-this':
    'duplicates native class-methods-use-this (verified 2026-10-14 · TS probe)',
  'typescript-js/default-param-last':
    'duplicates native default-param-last (verified 2026-10-14 · TS probe)',
  'typescript-js/init-declarations':
    'duplicates native init-declarations (verified 2026-10-14 · TS probe)',
  'typescript-js/max-params': 'duplicates native max-params (verified 2026-10-14 · TS probe)',
  'typescript-js/no-array-constructor':
    'duplicates native no-array-constructor (verified 2026-10-14 · TS probe)',
  'typescript-js/no-dupe-class-members':
    'duplicates native no-dupe-class-members (verified 2026-10-14 · TS probe)',
  'typescript-js/no-empty-function':
    'duplicates native no-empty-function (verified 2026-10-14 · TS probe)',
  'typescript-js/no-magic-numbers':
    'duplicates native no-magic-numbers (verified 2026-10-14 · TS probe)',
  'typescript-js/no-redeclare': 'duplicates native no-redeclare (verified 2026-10-14 · TS probe)',
  'typescript-js/no-shadow': 'duplicates native no-shadow (verified 2026-10-14 · TS probe)',
  'typescript-js/no-unused-expressions':
    'duplicates native no-unused-expressions (verified 2026-10-14 · TS probe)',
  'typescript-js/no-unused-private-class-members':
    'duplicates native no-unused-private-class-members (verified 2026-10-14 · TS probe)',
  'typescript-js/no-unused-vars':
    'duplicates native no-unused-vars (verified 2026-10-14 · TS probe)',
  'typescript-js/no-use-before-define':
    'duplicates native no-use-before-define (verified 2026-10-14 · TS probe)',
  'typescript-js/no-useless-constructor':
    'duplicates native no-useless-constructor (verified 2026-10-14 · TS probe)',
  'unicorn-js/comma-spacing': 'meta.languages JSON only: never reports on JS',
  'unicorn-js/consistent-arrow-return-style':
    'contradicts native arrow-body-style: the explicit return it demands on a multiline body is the block as-needed forbids',
  'unicorn-js/indent': 'meta.languages CSS/JSON only: never reports on JS',
  'unicorn-js/key-name-casing': 'meta.languages JSON/TOML/YAML only: never reports on JS',
  'unicorn-js/no-empty-link-text': 'meta.languages Markdown only: never reports on JS',
  'unicorn-js/no-javascript-url': 'meta.languages Markdown only: never reports on JS',
  'unicorn-js/no-loss-of-precision': 'meta.languages CSS/JSON/TOML only: never reports on JS',
  'unicorn-js/require-frontmatter-fields': 'meta.languages Markdown only: never reports on JS',
};

/**
options and severities other than a bare `error`
@type {NonNullable<Config['rules']>}
*/
const tuned = {
  'react-js/require-default-props': ['error', { functions: 'defaultArguments' }],
  // typed upstream, yet needs types only for the `types` option the wrapper refuses
  'typescript-js/naming-convention': [
    'warn',
    naming,
    { format: ['PascalCase'], selector: 'enumMember' },
    { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralProperty' },
    parameter,
    typeLike,
    { format: ['camelCase', 'UPPER_CASE'], selector: 'variable' },
  ],
  'unicorn-js/expiring-todo-comments': ['error', { checkDates: true }],
};

/** the native rule names of the oxlint that loads this config */
const schema = new URL('configuration_schema.json', import.meta.resolve('oxlint/package.json'));
const { definitions } = JSON.parse(String(readFileSync(schema)));
const native = new Set(Object.keys(definitions.DummyRuleMap.properties));

/** @type {Record<string, Rules> & { typescript: Rules }} */
const wrapped = Object.fromEntries(
  await Promise.all(
    ['eslint', 'import', 'react', 'typescript', 'unicorn'].map(async (scope) => {
      const { default: plugin } = await import(`./plugins/${scope}-js.mjs`);
      return [scope, plugin.rules];
    }),
  ),
);

/**
a wrapper's live rules oxlint lacks, unless opted out; typed ones only when tuned
@param {string} scope
@param {string} [prefix] the rules' native oxlint scope
*/
const derive = (scope, prefix = `${scope}/`) =>
  Object.entries(wrapped[scope] ?? {}).flatMap(([name, { meta }]) => {
    const key = `${scope}-js/${name}`;
    return meta.deprecated ||
      native.has(`${prefix}${name}`) ||
      Object.hasOwn(disabled, key) ||
      (meta.docs?.requiresTypeChecking && tuned[key] === undefined)
      ? []
      : [[key, tuned[key] ?? 'error']];
  });

const javascript = Object.fromEntries(
  [derive('eslint', ''), derive('import'), derive('react'), derive('unicorn')].flat(),
);

/** typescript-eslint's extensions replace their core rule on TS files */
const twins = Object.entries(wrapped.typescript)
  .map(
    ([name, { meta }]) =>
      `eslint-js/${meta.docs?.extendsBaseRule === true ? name : meta.docs?.extendsBaseRule}`,
  )
  .filter((key) => Object.hasOwn(javascript, key))
  .map((key) => [key, 'off']);

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
      ...Object.fromEntries([...twins, ...derive('typescript')]),
      'import-js/no-unresolved': 'off',
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
        'error',
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
    // the config is the default-exported defineConfig(…) call
    rules: {
      'import/no-default-export': 'off',
      'import/no-named-export': 'error',
      'unicorn-js/no-top-level-side-effects': 'off',
    },
  },
];

/** the nearest package.json from cwd decides; none found turns everything on */
const detectEnvironment = () => {
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

/** oxlint rejects version "detect"; no react installed gets a semver that keeps every version gate open and silences the plugin's warning */
const detectReact = () => {
  const { createRequire } = process.getBuiltinModule('node:module');
  let version = '';
  try {
    ({ version } = createRequire(`${process.cwd()}/package.json`)('react/package.json'));
  } catch {
    // no react installed: no version
  }
  const semver = /^\d+\.\d+\.\d+/u.exec(version);
  return { react: { version: semver?.[0] ?? '999.999.999' } };
};

// ※ oxlint-extends-objects
/**
@param {Config & { env?: Config['env'] & Partial<Env> }} [config]
@returns {Config}
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
    rules: { ...rules, ...javascript, ...config.rules },
    settings: { ...detectReact(), ...config.settings },
  };
};

export { defineConfig };

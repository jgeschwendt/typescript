// @ts-check

/** @typedef {import('oxlint').OxlintConfig} Config */
/** @typedef {import('oxlint').OxlintOverride} Override */
/** @typedef {{ bun: boolean; next: boolean; node: boolean | number; react: boolean; typescript: boolean }} Env */
/** @typedef {{ meta: { deprecated?: unknown; docs?: { requiresTypeChecking?: boolean } } }} Rule */

import { enabled } from './plugins/enabled.js';

const { existsSync, readFileSync } = process.getBuiltinModule('node:fs');
const { createRequire } = process.getBuiltinModule('node:module');
const { basename, dirname, join } = process.getBuiltinModule('node:path');
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
// no react-hooks-js: oxlint has eslint-plugin-react-hooks natively but memoized-effect-dependencies, config, gating and fbt (7.1.1 · 2026-10-23); one rule is not worth its 119 packages
const jsPlugins = [
  { name: 'import-js', specifier: absolute('./plugins/import-js.js') },
  { name: 'react-js', specifier: absolute('./plugins/react-js.js') },
  { name: 'unicorn-js', specifier: absolute('./plugins/unicorn-js.js') },
  absolute('./plugins/comments.js'),
  absolute('./plugins/eslint-js.js'),
  absolute('./plugins/inline-config.js'),
  absolute('./plugins/types.js'),
  absolute('./plugins/typescript-js.js'),
];

// ※ oxlint-peer-coupling
/** @type {NonNullable<Config['categories']>} */
const categories = {
  correctness: 'error',
  nursery: 'warn',
  pedantic: 'error',
  perf: 'error',
  restriction: 'error',
  style: 'error',
  suspicious: 'error',
};

/** code lines per file, blanks and comments aside: the only size ceiling */
const maxLines = 2000;
/** JSX nesting below a root: 2, the default, fails any real tree; 7 is the round-4 consumer reading */
const maxJsxDepth = 7;
/** the words name-replacements leaves alone under React */
const reactNames = { props: false, ref: false, refs: false };

/** the native rule names of the oxlint that loads this config */
const schema = new URL('configuration_schema.json', import.meta.resolve('oxlint/package.json'));
const { definitions } = JSON.parse(String(readFileSync(schema)));
const native = new Set(Object.keys(definitions.DummyRuleMap.properties));

/**
every rule the base turns off, each for a fact: a native key is off in `rules`, a -js key never runs
@type {Readonly<Record<string, string>>}
*/
// ※ opt-out-map
const off = Object.freeze({
  'capitalized-comments': 'house inline comments are lowercase fragments',
  'import/no-named-export': 'contradicts import/no-default-export: together no export passes',
  'import/prefer-default-export': 'contradicts import/no-default-export, which the base enforces',
  'max-lines-per-function': 'max-lines is the ceiling: a function is at most its file',
  'no-continue': 'contradicts unicorn/prefer-continue, which wants the guard-continue this forbids',
  'no-ternary': 'bans ternaries, syntax the house writes',
  'no-undefined': 'bans undefined, syntax the house writes',
  'no-unexpected-multiline':
    "eslint-config-prettier's residue: unreachable after the semicolons oxfmt writes (probed against oxfmt)",
  'oxc/no-async-await': 'bans async/await, syntax the house writes',
  'oxc/no-optional-chaining': 'bans ?., syntax the house writes',
  'oxc/no-rest-spread-properties': 'bans object rest/spread, syntax the house writes',
  'react/function-component-definition':
    'contradicts native func-style: the function declaration it demands is the one func-style forbids (verified 2026-10-20 · probe)',
  'react/react-in-jsx-scope': 'the automatic JSX runtime needs no React in scope',
  'react/todo': "reports the React Compiler's own unimplemented syntax, not the code's",
  'typescript/ban-types':
    'removed upstream in typescript-eslint 8: double-reports with its successors no-empty-object-type, no-unsafe-function-type and no-wrapper-object-types',
  'typescript/no-empty-interface':
    'deprecated upstream: double-reports with its successor no-empty-object-type',
  'typescript/no-var-requires':
    'deprecated upstream: double-reports with its successor no-require-imports',
  'typescript/prefer-ts-expect-error':
    'deprecated upstream: double-reports with its successor ban-ts-comment',
  'unicorn/empty-brace-spaces':
    "eslint-config-prettier's residue: brace spaces oxfmt formats (probed against oxfmt)",
  'unicorn/no-nested-ternary':
    "eslint-config-prettier's residue: nested ternaries are native no-nested-ternary's (probed against oxfmt)",
  'unicorn/number-literal-case':
    "eslint-config-prettier's residue: conflicts with oxfmt over 0xff vs 0xFF (probed against oxfmt)",

  'eslint-js/consistent-return':
    'with no-useless-return, no-useless-undefined and no-null a value-or-nothing function has no passing form; the ts override already drops it',
  'import-js/dynamic-import-chunkname':
    "demands webpack's magic comment; Next, Turbopack and Bun name chunks themselves",
  'import-js/enforce-node-protocol-usage':
    'duplicates native unicorn/prefer-node-protocol; without its required option it crashes: Missing option',
  'import-js/no-unused-modules':
    'inert without options; with unusedExports it fails every JS rule on the file (ESLint 10 exports no lib/util/glob-utils)',
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
});

// ※ oxlint-base
/** @type {NonNullable<Config['rules']>} */
const rules = {
  ...Object.fromEntries(
    Object.keys(off)
      .filter((key) => native.has(key))
      .map((key) => [key, 'off']),
  ),

  curly: ['error', 'all'],
  'no-magic-numbers': [
    'error',
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
  // natural: a2 before a10; a blank line opens a group whose order encodes meaning
  'sort-keys': ['error', 'asc', { allowLineSeparatedGroups: true, natural: true }],

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

  'max-lines': ['error', { max: maxLines, skipBlankLines: true, skipComments: true }],
  // positional, max then flag: a lone over-long top-level function passes; a second reports both
  'max-statements': ['error', {}, { ignoreTopLevelFunctions: true }],

  'import/no-default-export': 'error',
  // one statement per module: a type-only name joins the value import inline
  'import/no-duplicates': ['error', { preferInline: true }],

  'react/jsx-curly-brace-presence': [
    'error',
    { children: 'always', propElementValues: 'always', props: 'never' },
  ],
  'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
  'react/jsx-max-depth': ['error', { max: maxJsxDepth }],

  // the literal is what types/prefer-readonly-generic wraps; an interface cannot be
  'typescript/consistent-type-definitions': ['error', 'type'],
  // inline, not split: `import { T, x }` fixes to `import { type T, x }`
  'typescript/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
  'typescript/prefer-readonly-parameter-types': 'warn',

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
  'no-unnecessary-condition',
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
  'no-unsafe-enum-assignment',
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
  'prefer-optional-chain',
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
    // a name the running oxlint lacks fails the config: emit only the installed catalog's
    rules: Object.fromEntries(
      typescriptOnly
        .map((name) => `typescript/${name}`)
        .filter((key) => native.has(key))
        .map((key) => [key, 'off']),
    ),
  },
  // a describe body holds one statement per test
  { files: ['**/*.test.*', '**/__tests__/**'], rules: { 'max-statements': 'off' } },
];

const naming = {
  format: ['camelCase'],
  leadingUnderscore: 'forbid',
  selector: 'default',
  trailingUnderscore: 'forbid',
};
/** a name that needs quotes belongs to the DOM or a wire format, not the code */
const quoted = {
  format: [],
  modifiers: ['requiresQuotes'],
  selector: ['objectLiteralProperty', 'typeProperty'],
};
const parameter = { format: ['camelCase'], leadingUnderscore: 'allow', selector: 'parameter' };
const typeLike = { format: ['PascalCase'], selector: 'typeLike' };

/** naming-convention's entries after the severity, per file set: a consumer override restates the rule, since its options replace the base's */
const namingConvention = Object.freeze({
  default: [
    naming,
    { format: ['PascalCase'], selector: 'enumMember' },
    { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralProperty' },
    quoted,
    parameter,
    typeLike,
    { format: ['camelCase', 'UPPER_CASE'], selector: 'variable' },
  ],
  route: [
    naming,
    { format: ['UPPER_CASE'], selector: 'function' },
    quoted,
    parameter,
    typeLike,
    { format: ['camelCase', 'UPPER_CASE'], selector: 'variable' },
  ],
  tsx: [
    naming,
    { format: ['camelCase', 'PascalCase'], selector: 'function' },
    { format: ['camelCase', 'PascalCase'], selector: 'import' },
    { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralMethod' },
    { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralProperty' },
    quoted,
    parameter,
    typeLike,
    { format: ['camelCase', 'PascalCase'], selector: 'typeProperty' },
    { format: ['camelCase', 'PascalCase', 'UPPER_CASE'], selector: 'variable' },
  ],
});

/**
options and severities other than a bare `error`
@type {NonNullable<Config['rules']>}
*/
const tuned = {
  'react-js/require-default-props': ['error', { functions: 'defaultArguments' }],
  // typed upstream, yet needs types only for the `types` option the wrapper refuses
  'typescript-js/naming-convention': ['warn', ...namingConvention.default],
  'unicorn-js/expiring-todo-comments': ['error', { checkDates: true }],

  // one member order for js and ts: public before private, accessors with public methods (unicorn has no accessor group)
  'typescript-js/member-ordering': [
    'error',
    {
      default: {
        memberTypes: [
          'signature',
          'call-signature',
          'static-field',
          'public-field',
          'protected-field',
          'private-field',
          '#private-field',
          'static-initialization',
          'constructor',
          'static-method',
          ['get', 'set', 'accessor', 'public-method', 'protected-method'],
          ['private-method', '#private-method'],
        ],
      },
    },
  ],
  'unicorn-js/consistent-class-member-order': [
    'error',
    {
      order: [
        'static-field',
        'public-field',
        'private-field',
        'static-block',
        'constructor',
        'static-method',
        'public-method',
        'private-method',
      ],
    },
  ],
};

const node22 = 22;
const node24 = 24;
const node26 = 26;
/** unicorn rules that name an API or syntax, keyed by the first Node major that runs it (probed 2026-10-21 on 20.20.2, 22.23.3, 24.21.0, 26.12.0; Bun 1.4 has every one; nothing has Iterator.zip) */
const floors = {
  'unicorn-js/prefer-array-from-async': node22,
  // `using` is syntax Node 22 rejects; a compiler that downlevels it can set env.node
  'unicorn-js/prefer-dispose': node24,
  'unicorn-js/prefer-error-is-error': node24,
  'unicorn-js/prefer-get-or-insert-computed': node26,
  'unicorn-js/prefer-group-by': node22,
  'unicorn-js/prefer-iterator-concat': node26,
  'unicorn-js/prefer-iterator-helpers': node22,
  'unicorn-js/prefer-iterator-to-array': node22,
  'unicorn-js/prefer-iterator-to-array-at-end': node22,
  'unicorn-js/prefer-iterator-zip': Infinity,
  'unicorn-js/prefer-promise-try': node24,
  'unicorn-js/prefer-promise-with-resolvers': node22,
  'unicorn-js/prefer-regexp-escape': node24,
  'unicorn-js/prefer-set-methods': node22,
  'unicorn-js/prefer-temporal': node26,
  'unicorn-js/prefer-temporal-conversion': node26,
  'unicorn-js/prefer-uint8array-base64': node26,
  'unicorn-js/prefer-uint8array-hex': node26,
};

/** @type {Record<'eslint' | 'import' | 'react' | 'typescript' | 'unicorn', Record<string, Rule>>} */
const wrapped = Object.fromEntries(
  await Promise.all(
    ['eslint', 'import', 'react', 'typescript', 'unicorn'].map(async (scope) => {
      const { default: plugin } = await import(`./plugins/${scope}-js.js`);
      return [scope, plugin.rules];
    }),
  ),
);

/**
a wrapper's live rules oxlint lacks, unless opted out; typed ones only when tuned; by key first, so only a candidate's rule module loads
@param {keyof typeof wrapped} scope
*/
const derive = (scope) =>
  Object.keys(wrapped[scope]).flatMap((name) => {
    const key = `${scope}-js/${name}`;
    if (native.has(scope === 'eslint' ? name : `${scope}/${name}`) || Object.hasOwn(off, key)) {
      return [];
    }
    const meta = wrapped[scope][name]?.meta;
    return meta?.deprecated || (meta?.docs?.requiresTypeChecking && tuned[key] === undefined)
      ? []
      : [[key, tuned[key] ?? 'error']];
  });

const javascript = Object.fromEntries(
  [derive('eslint'), derive('import'), derive('react'), derive('unicorn')].flat(),
);

/**
typescript-eslint's extensions replace their core rule on TS files: each shares its core rule's name, but these (rules.test.js proves the list)
@type {Record<string, string | undefined>}
*/
const renamed = { 'only-throw-error': 'no-throw-literal' };
const twins = Object.keys(wrapped.typescript)
  .map((name) => `eslint-js/${renamed[name] ?? name}`)
  .filter((key) => Object.hasOwn(javascript, key))
  .map((key) => [key, 'off']);

// later overrides win: the .ts, .tsx, then route.ts naming-convention sets, in that order
/** @type {Override} */
const typescript = {
  files: ['**/*.{cts,mts,ts,tsx}'],
  rules: {
    // prefer-inline flags a lone `import type`, which no-import-type-side-effects requires; no-duplicates inlines instead
    'import/consistent-type-specifier-style': 'off',
    'import/extensions': 'off',
    'no-implied-eval': 'off',
    'prefer-promise-reject-errors': 'off',
    'require-await': 'off',
    'types/prefer-readonly-generic': 'error',
    ...Object.fromEntries([...twins, ...derive('typescript')]),
    'import-js/no-unresolved': 'off',
  },
};

/** an override's options replace the base's: a consumer relaxing no-unresolved restates ^bun: @type {Override} */
const bun = {
  files: ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'],
  globals: { Bun: 'readonly' },
  rules: { 'import-js/no-unresolved': ['error', { ignore: ['^bun:'] }] },
};

/** @type {Override[]} */
const react = [
  // no browser env: Ink is React with no window; a consumer with a DOM sets env.browser itself
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: ['jsx-a11y', 'react-perf'],
    // react-perf guards memoized children against fresh props; a host element (div, span) has none
    rules: Object.fromEntries(
      [
        'jsx-no-jsx-as-prop',
        'jsx-no-new-array-as-prop',
        'jsx-no-new-function-as-prop',
        'jsx-no-new-object-as-prop',
      ].map((rule) => [`react-perf/${rule}`, ['error', { nativeAllowList: 'all' }]]),
    ),
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'typescript-js/naming-convention': ['warn', ...namingConvention.tsx],
    },
  },
  // React's names are `props`, `ref`, `inputRef`, `ButtonProps`: the word, not the identifier, since the rule splits camelCase
  {
    files: ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'],
    rules: { 'unicorn-js/name-replacements': ['error', { replacements: reactNames }] },
  },
];

/** Next's segment files */
const segments =
  '**/{default,error,forbidden,global-error,layout,loading,not-found,page,template,unauthorized}.{jsx,tsx}';

/** @type {Override[]} */
const next = [
  { files: ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'], plugins: ['nextjs'] },
  // `params`, `searchParams`, `generateStaticParams` are Next's; options replace, so React's words ride along
  {
    files: ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'],
    rules: {
      'unicorn-js/name-replacements': ['error', { replacements: { ...reactNames, params: false } }],
    },
  },
  {
    files: ['**/route.ts'],
    rules: {
      'typescript-js/naming-convention': ['warn', ...namingConvention.route],
    },
  },
  // segment files export reserved names (metadata, segment config) beside the component
  {
    files: [segments],
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
    files: [segments, '**/mdx-components.{jsx,tsx}'],
    rules: { 'unicorn/filename-case': ['error', { case: 'kebabCase' }] },
  },
  // the file conventions Next reads a default export from
  {
    files: [
      '**/{apple-icon,default,error,forbidden,global-error,icon,layout,loading,manifest,middleware,not-found,opengraph-image,page,proxy,robots,sitemap,template,twitter-image,unauthorized}.{js,jsx,ts,tsx}',
    ],
    rules: { 'import/no-default-export': 'off' },
  },
  // the conventions that name several exports: image alt/size/contentType, segment config, handlers
  {
    files: [
      '**/{apple-icon,icon,instrumentation,layout,middleware,opengraph-image,page,proxy,route,twitter-image}.{js,jsx,ts,tsx}',
    ],
    rules: { 'import/group-exports': 'off' },
  },
  {
    files: ['**/instrumentation.{js,ts}'],
    rules: { 'require-await': 'off', 'typescript/require-await': 'off' },
  },
];

/** @type {Override} */
const tooling = {
  files: ['./{eslint,jest,next,oxfmt,oxlint,postcss}.config.{cjs,cts,js,mjs,mts,ts}'],
  // the config is the default-exported defineConfig(…) call
  rules: {
    'import/no-default-export': 'off',
    'import/no-named-export': 'error',
    // a config runs under node: node:fs is how it reads beside itself
    'import/no-nodejs-modules': 'off',
    'unicorn-js/no-top-level-side-effects': 'off',
  },
};

/**
`directory` and every directory above it, nearest first
@param {string} directory
@returns {string[]}
*/
const ancestors = (directory) =>
  dirname(directory) === directory ? [directory] : [directory, ...ancestors(dirname(directory))];

/** the oxlint config on the stack, else the first file other than this one: defineConfig's caller through any wrapper */
const caller = () => {
  const { stack } = new Error('the caller');
  const files = String(stack)
    .split('\n')
    // Node's frames carry file:// URLs (oxlint appends ?cache=), Bun's bare paths
    .flatMap((frame) => /(?<=[\s(])(?:file:\/\/)?\/[^()]*(?=:\d+:\d+\)?$)/u.exec(frame) ?? [])
    .map((location) => fileURLToPath(new URL(location, import.meta.url)))
    .filter((file) => file !== import.meta.filename);
  return files.find((file) => /^oxlint\.config\.[cm]?[jt]s$/u.test(basename(file))) ?? files[0];
};

/** the directory of defineConfig's caller: oxlint evaluates every nested config from the root's cwd */
const origin = () => {
  const file = caller();
  return file === undefined ? process.cwd() : dirname(file);
};

/** every package.json from the config's directory up, nearest first; a workspace declares engines at its root */
const manifests = () => {
  const found = [];
  for (const directory of ancestors(origin())) {
    const file = join(directory, 'package.json');
    if (!existsSync(file)) {
      continue;
    }
    const manifest = JSON.parse(String(readFileSync(file)));
    found.push({ directory, ...manifest });
  }
  return found;
};

/** where oxlint's binary looks for tsgolint first */
const tsgolintVariable = 'OXLINT_TSGOLINT_PATH';
const executable = process.platform === 'win32' ? 'tsgolint.exe' : 'tsgolint';

/** the base's own tsgolint, resolved as oxlint-tsgolint's bin resolves it; none on a platform without a build */
const ownTsgolint = () => {
  try {
    return createRequire(import.meta.resolve('oxlint-tsgolint/package.json')).resolve(
      `@oxlint-tsgolint/${process.platform}-${process.arch}/${executable}`,
    );
  } catch {
    return '';
  }
};

/** points oxlint at the base's tsgolint, unless something already does; Bun's process.env never reaches the native binary's environ (probed 2026-10-27), so there only a node_modules/.bin/tsgolint serves, from cwd up as the binary looks, not the config's directory */
const hasTsgolint = () => {
  const path = ownTsgolint();
  if (path === '') {
    return false;
  }
  process.env[tsgolintVariable] ??= path;
  return (
    !process.versions.bun ||
    ancestors(process.cwd()).some((directory) =>
      existsSync(join(directory, 'node_modules', '.bin', 'tsgolint')),
    )
  );
};

/** the package.json nearest the config decides the dependencies, the nearest with `engines` the floor; none found turns everything on */
const detectEnvironment = () => {
  const [nearest, ...above] = manifests();
  if (nearest === undefined) {
    return { bun: true, next: true, react: true, tsgolint: hasTsgolint(), typescript: true };
  }
  const { dependencies, devDependencies, directory } = nearest;
  const installed = { ...dependencies, ...devDependencies };
  const { engines } = [nearest, ...above].find((manifest) => manifest.engines) ?? {};
  const major = /^(?:>=|[>^~])?\s*(?<major>\d+)/u.exec(engines?.node ?? '')?.[1];
  const isTypescript = 'typescript' in installed;
  return {
    bun:
      '@types/bun' in installed ||
      existsSync(join(directory, 'bun.lock')) ||
      existsSync(join(directory, 'bun.lockb')),
    next: 'next' in installed,
    // Bun has every floored API
    node: major ? Number(major) : engines?.bun && Infinity,
    react: 'react' in installed,
    // type-aware runs tsgolint, else oxlint fails "Failed to find tsgolint executable": the consumer's own, else the base's
    tsgolint: isTypescript && ('oxlint-tsgolint' in installed || hasTsgolint()),
    typescript: isTypescript,
  };
};

/** oxlint rejects version "detect": the React the config's directory resolves, else a semver that keeps every version gate open and silences the plugin's warning */
const detectReact = () => {
  let version = '';
  try {
    ({ version } = createRequire(join(origin(), 'package.json'))('react/package.json'));
  } catch {
    // no react installed: no version
  }
  const semver = /^\d+\.\d+\.\d+/u.exec(version);
  return { react: { version: semver?.[0] ?? '999.999.999' } };
};

/**
oxlint's root-only options, for the config in its cwd unless `root` says otherwise: a nested config naming any fails the run, so cwd, not the config's directory, decides
@param {boolean | undefined} root
@param {boolean} isTypeAware
@param {Config['options']} options
@returns {false | Pick<Config, 'options'>}
*/
const rootOptions = (root, isTypeAware, options) =>
  (root ?? origin() === process.cwd()) && {
    options: { reportUnusedDisableDirectives: 'error', typeAware: isTypeAware, ...options },
  };

/** oxfmt's default printWidth */
const printWidth = 100;

/** oxfmt's config names, in its lookup order */
const oxfmtConfigs = ['.oxfmtrc.json', '.oxfmtrc.jsonc', 'oxfmt.config.ts', 'oxfmt.config.mts'];

/**
the printWidth of the oxfmt config nearest defineConfig's caller: JSON or JSONC parsed with its comments stripped outside strings, then its trailing commas, a TS config required (Node 24 strips types, Bun runs them)
@returns {number}
*/
const oxfmtWidth = () => {
  const file = ancestors(origin())
    .flatMap((directory) => oxfmtConfigs.map((name) => join(directory, name)))
    .find((path) => existsSync(path));
  if (file === undefined) {
    return printWidth;
  }
  const options = /\.jsonc?$/u.test(file)
    ? JSON.parse(
        String(readFileSync(file))
          .replaceAll(/(?<string>"(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/.*$/gmu, '$<string>')
          // a comma dropped inside a string changes only that string, never printWidth
          .replaceAll(/,(?=\s*[}\]])/gu, ''),
      )
    : createRequire(file)(file).default;
  return options.printWidth ?? printWidth;
};

// ※ oxlint-extends-objects
/**
@param {Config & { env?: Config['env'] & Partial<Env>; root?: boolean }} [config]
@returns {Config}
*/
const defineConfig = ({
  env: {
    bun: isBun,
    next: isNext,
    node: isNode,
    react: isReact,
    typescript: isTypescript,
    ...others
  } = {},
  root: isRoot,
  ...config
} = {}) => {
  const detected = detectEnvironment();
  const typed = isTypescript ?? detected.typescript;
  // an unknown runtime keeps every rule
  const major =
    [isNode, isBun && Infinity, detected.node].find((value) => typeof value === 'number') ??
    Infinity;
  // a boolean env.node is oxlint's globals; a numeric one, the runtime floor, is ours
  const environments = { ...others, ...(typeof isNode === 'boolean' && { node: isNode }) };
  const built = {
    ...config,
    // oxlint's own env keys pass through; bun/next/react/typescript are ours
    ...(Object.keys(environments).length > 0 && { env: environments }),
    categories: { ...categories, ...config.categories },
    jsPlugins: [...jsPlugins, ...(config.jsPlugins ?? [])],
    ...rootOptions(isRoot, typed && detected.tsgolint, config.options),
    overrides: [
      ...always,
      // before the TypeScript override, whose import-js/no-unresolved off must win on TS files
      ...((isBun ?? detected.bun) ? [bun] : []),
      ...(typed ? [typescript] : []),
      ...((isReact ?? detected.react) ? react : []),
      ...((isNext ?? detected.next) ? next : []),
      tooling,
      ...(config.overrides ?? []),
    ],
    plugins: [...new Set([...plugins, ...(config.plugins ?? [])])],
    rules: {
      ...rules,
      ...javascript,
      ...Object.fromEntries(
        Object.entries(floors).flatMap(([key, floor]) => (major < floor ? [[key, 'off']] : [])),
      ),
      // a divider ends where oxfmt wraps
      'comments/divider': ['error', { width: oxfmtWidth() }],
      ...config.rules,
    },
    settings: { ...detectReact(), ...config.settings },
  };
  // oxlint rejects a configured rule, `off` too, that its plugin does not list: record every key, across every config (a nested one adds)
  const keys = [built.rules, ...built.overrides.map((override) => override.rules)].flatMap((set) =>
    Object.keys(set ?? {}),
  );
  for (const key of keys) {
    enabled.add(key);
  }
  return built;
};

export { defineConfig, namingConvention, off };

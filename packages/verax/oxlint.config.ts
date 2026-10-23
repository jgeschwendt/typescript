import { defineConfig } from '@jlg/oxlint';

/**
the base's naming-convention set but its variable entry, which an override restates whole
*/
const naming = [
  {
    format: ['camelCase'],
    leadingUnderscore: 'forbid',
    selector: 'default',
    trailingUnderscore: 'forbid',
  },
  { format: ['PascalCase'], selector: 'enumMember' },
  { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralProperty' },
  { format: [], modifiers: ['requiresQuotes'], selector: 'objectLiteralProperty' },
  // GraphQL's own union tag
  {
    filter: { match: true, regex: '^__typename$' },
    format: null,
    selector: 'objectLiteralProperty',
  },
  { format: ['camelCase'], leadingUnderscore: 'allow', selector: 'parameter' },
  { format: ['PascalCase'], selector: 'typeLike' },
] as const;

/**
the base's no-unused-vars options, which an override restates whole
*/
const unused = {
  args: 'after-used',
  caughtErrors: 'all',
  ignoreRestSiblings: false,
  reportVarsOnlyUsedAsTypes: true,
  vars: 'all',
} as const;

export default defineConfig({
  // engines.node >=22: rules naming an API Node 22 lacks (Error.isError among them) stay off
  env: { node: 22 },
  ignorePatterns: ['dist/**'],
  overrides: [
    // `new Set(tags).size` is the unique count; prefer-set-size refuses the spread that would avoid it
    {
      files: ['__tests__/bounds.test.ts'],
      rules: { 'unicorn-js/no-unreadable-new-expression': 'off' },
    },
    {
      files: ['examples/*.ts'],
      rules: {
        // examples import the package under test from ../src, as tests do
        'import/no-relative-parent-imports': 'off',
        // a teaching page: each comment annotates the line it shows, and the run prints its results
        'no-console': 'off',
        'no-inline-comments': 'off',
        // a schema and its type share a name, the declaration merge TypeScript intends
        'no-redeclare': 'off',
        // `switch (true)` over `is` guards: the default branch is the rest
        'typescript/switch-exhaustiveness-check': [
          'error',
          { considerDefaultExhaustiveForUnions: true },
        ],
        'typescript-js/naming-convention': [
          'warn',
          ...naming,
          { format: ['camelCase', 'PascalCase'], selector: 'variable' },
        ],
        // a runnable page: its top level is the run
        'unicorn-js/no-top-level-side-effects': 'off',
        // lib ES2024 types no FormData[Symbol.iterator]; entries() is the typed path
        'unicorn-js/prefer-direct-iteration': 'off',
      },
    },
    {
      files: ['src/core.ts'],
      rules: {
        // a schema's own keys enumerate as built: def, then ~standard
        'sort-keys': 'off',
        // a private symbol ends a full check early; only verify catches it
        'typescript/only-throw-error': 'off',
        // the call's budget is module state: nested frames share it, and every entry resets it
        'unicorn-js/no-top-level-assignment-in-function': 'off',
      },
    },
    // the package entry is a re-export list by design
    { files: ['src/index.ts'], rules: { 'unicorn-js/no-barrel-files': 'off' } },
    {
      files: ['__tests__/property.test.ts'],
      rules: {
        // for-of would run the value's iterator; the oracle reads by index, as verax does
        'typescript/prefer-for-of': 'off',
        'unicorn-js/no-for-loop': 'off',
        // lib is ES2024, which types no iterator helpers
        'unicorn-js/prefer-iterator-helpers': 'off',
        'unicorn-js/prefer-iterator-to-array': 'off',
        // Object.entries reads every value up front; the oracle, like verax, stops at the first failure
        'unicorn-js/prefer-object-iterable-methods': 'off',
      },
    },
    // a vendored subset of the Standard Schema spec: its names are the spec's
    {
      files: ['src/standard.ts'],
      rules: {
        'no-redeclare': 'off',
        'typescript/no-namespace': 'off',
        'typescript-js/naming-convention': 'off',
        'unicorn-js/name-replacements': 'off',
      },
    },
    {
      files: ['src/types.ts'],
      rules: {
        // every key for…in enumerates is counted, inherited ones too
        'guard-for-in': 'off',
        // a field copies its impl's checks: in place would write into the shared impl
        'oxc/no-map-spread': 'off',
        // `test?.(each)` is a nullable boolean, which strict-boolean-expressions refuses
        'typescript/prefer-optional-chain': 'off',
        // a list's output is sized up front: growing it is 2–3× slower
        'unicorn/no-new-array': 'off',
        // `key in Object.prototype` is the check: an inherited accessor such as __proto__
        'unicorn-js/no-computed-property-existence-check': 'off',
        // push's returned length is the index it filled, in the same step
        'unicorn-js/no-return-array-push': 'off',
        // the bounds beside each check sit below 2^53; isSafeInteger made a valid Int list's `is` 55–72% slower (measured 2026-10-22)
        'unicorn-js/prefer-number-is-safe-integer': 'off',

        // counting the keys for…in enumerates binds one it never reads: `_key`, which tsc's noUnusedLocals exempts
        'no-underscore-dangle': ['error', { allow: ['_key'] }],
        'no-unused-vars': ['error', { ...unused, varsIgnorePattern: '^_key$' }],
        'typescript-js/naming-convention': [
          'warn',
          ...naming,
          { filter: '^_key$', format: null, selector: 'variable' },
          { format: ['camelCase', 'UPPER_CASE'], selector: 'variable' },
        ],
      },
    },
    // tests hand verax thenables, holes, non-Error throws and cross-realm promises
    {
      files: ['__tests__/*.ts'],
      rules: {
        // fast-check's names collide with verax's; a second copy's type is the module's own
        'import/no-namespace': ['error', { ignore: ['../src/index.js', 'fast-check'] }],
        // tests sit beside src, as in @jlg/oxlint: they import the module under test from ../src
        'import/no-relative-parent-imports': 'off',
        'no-sparse-arrays': 'off',
        'no-throw-literal': 'off',
        // type tests declare schemas read only by `typeof`; a rest destructure omits a key unread
        'no-unused-vars': [
          'error',
          { ...unused, ignoreRestSiblings: true, reportVarsOnlyUsedAsTypes: false },
        ],
        'typescript/only-throw-error': 'off',
        'typescript/promise-function-async': 'off',
        // a schema const is named like the type it validates, a scalar like a GraphQL type: `const User = object(…)`
        'typescript-js/naming-convention': [
          'warn',
          ...naming,
          { format: ['camelCase', 'PascalCase'], selector: 'import' },
          { format: ['camelCase', 'PascalCase'], selector: 'objectLiteralMethod' },
          { format: ['camelCase', 'PascalCase', 'UPPER_CASE'], selector: 'variable' },
        ],
        'unicorn/no-thenable': 'off',
        // `literal(undefined)` is a schema of undefined, not a redundant argument
        'unicorn/no-useless-undefined': ['error', { checkArguments: false }],
      },
    },
  ],
  rules: {
    // a shape's cyclomatic count is the check itself; splitting it costs a call per value
    complexity: 'off',
    // switch-exhaustiveness-check proves every case; a default would hide a new one
    'default-case': 'off',
    // arrows and overloaded declarations each fit where they are used
    'func-style': 'off',
    // `at`, `of`, `id` are the domain's words
    'id-length': 'off',
    // a library's export stays at its declaration
    'import/exports-last': 'off',
    'import/group-exports': 'off',
    // a lazy cache (a resolved shape) starts unset
    'init-declarations': 'off',
    // the internal schema constructor takes its parts positionally; a bag would allocate
    'max-params': 'off',
    // hot paths inline their checks; a helper per loop body costs a call per item
    'max-statements': 'off',
    // a no-op callback is the minimal way to swallow a rejection
    'no-empty-function': 'off',
    // limits and bounds read clearest as literals where they are used
    'no-magic-numbers': 'off',
    // one level of nesting states a three-way choice in one expression
    'no-nested-ternary': 'off',
    // recursive schemas name themselves inside getters; only a same-scope use hits the TDZ
    'no-use-before-define': ['error', { classes: true, functions: false, variables: false }],
    // destructuring one property is ceremony
    'prefer-destructuring': 'off',
    // inference types internal functions; exported ones stay explicit
    'typescript/explicit-function-return-type': 'off',
    // a validator's job is the one assertion the rule forbids: checked `unknown` becomes `T`
    'typescript/no-unsafe-type-assertion': 'off',
    // `x!` and `x as T` are the same claim; no-non-null-assertion keeps the former out
    'typescript/non-nullable-type-assertion-style': 'off',
    // nothing here mutates its arguments
    'typescript/prefer-readonly-parameter-types': 'off',
    // schemas compose by nesting calls: list(nullable(string())) is the DSL
    'unicorn/max-nested-calls': 'off',
    // a fold is a reduce
    'unicorn/no-array-reduce': 'off',
    'unicorn/no-nested-ternary': 'off',
    // GraphQL null is data, distinct from an absent key
    'unicorn/no-null': 'off',
    // predicates and flags take the domain's words: the API's `is`, a leaf's `test`, `overflow`
    'unicorn-js/consistent-boolean-name': 'off',
    // `def` is the API's word: every schema carries one
    'unicorn-js/name-replacements': ['error', { replacements: { def: false } }],
    // contradicts native unicorn/prefer-number-properties, which demands the Number.NaN it forbids
    'unicorn-js/prefer-global-number-constants': 'off',
    // a try spans the walk it guards: one handler per call, never one per item
    'unicorn-js/try-complexity': 'off',
  },
});

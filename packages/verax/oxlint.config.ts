import { defineConfig } from '@jlg/oxlint';

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
  ignorePatterns: ['dist/**'],
  overrides: [
    {
      files: ['__tests__/bounds.test.ts'],
      rules: {
        // a thunk hands verax another realm's promise: an async one would wrap it in this realm's
        'typescript/promise-function-async': 'off',
        // `new Set(tags).size` is the unique count; prefer-set-size refuses the spread that would avoid it
        'unicorn-js/no-unreadable-new-expression': 'off',
      },
    },
    {
      files: ['src/core.ts'],
      rules: {
        // switch-exhaustiveness-check proves every case; a default would hide a new one
        'default-case': 'off',
        // `verify` is bound as every entry: as a bound arrow, bun's parse/validate ran up to 2.6% slower (measured 2026-11-23)
        'func-style': 'off',
        // a no-op callback is the minimal way to swallow a rejection
        'no-empty-function': 'off',
        // the last-resort message is a three-way choice; an if chain would repeat the call
        'no-nested-ternary': 'off',
        // a schema's own keys enumerate as built: def, then ~standard
        'sort-keys': 'off',
        // the call's budget is module state: nested frames share it, and every entry resets it
        'unicorn-js/no-top-level-assignment-in-function': 'off',
      },
    },
    {
      files: ['src/core.ts', 'src/types.ts'],
      rules: {
        // a lazy cache (a resolved shape) starts unset: `= undefined` trips no-undef-init and unicorn/no-useless-undefined
        'init-declarations': 'off',
        // the internal schema constructor takes its parts positionally; a bag would allocate
        'max-params': 'off',
        // hot paths inline their checks; a helper per loop body costs a call per item
        'max-statements': 'off',
        // a validator's job is the one assertion the rule forbids: checked `unknown` becomes `T`
        'typescript/no-unsafe-type-assertion': 'off',
        // `x!` and `x as T` are the same claim; no-non-null-assertion keeps the former out
        'typescript/non-nullable-type-assertion-style': 'off',
        // a check writes its issues, path and output into what it is handed
        'typescript/prefer-readonly-parameter-types': 'off',

        // predicates and flags take the domain's words: the API's `is`, a leaf's `test`, `overflow`
        'unicorn-js/consistent-boolean-name': 'off',
        // `def` is the API's word: every schema carries one
        'unicorn-js/name-replacements': ['error', { replacements: { def: false } }],
        // a try spans the walk it guards: one handler per call, never one per item
        'unicorn-js/try-complexity': 'off',
      },
    },
    // the package entry is a re-export list by design
    { files: ['src/index.ts'], rules: { 'unicorn-js/no-barrel-files': 'off' } },
    {
      files: ['src/sdl.ts'],
      rules: {
        // switch-exhaustiveness-check proves every case; a default would hide a new one
        'default-case': 'off',
        // each refusal is a statement: one rule GraphQL has, checked where it applies
        'max-statements': 'off',
        // bareType and reference recurse into each other
        'no-use-before-define': ['error', { variables: false }],
        // a callback's parameters are its callee's; a schema's validate is a method, not state
        'typescript/prefer-readonly-parameter-types': [
          'warn',
          { ignoreInferredTypes: true, treatMethodsAsReadonly: true },
        ],

        // `def` is the API's word: every schema carries one
        'unicorn-js/name-replacements': ['error', { replacements: { def: false } }],
      },
    },
    // a vendored subset of the Standard Schema spec: its names and shapes are the spec's
    {
      files: ['src/standard.ts'],
      rules: {
        'import/group-exports': 'off',
        'no-redeclare': 'off',
        'typescript/no-namespace': 'off',
        'typescript/prefer-readonly-parameter-types': 'off',

        'unicorn-js/name-replacements': 'off',
      },
    },
    {
      files: ['src/types.ts'],
      rules: {
        // every key for…in enumerates is counted, inherited ones too
        'guard-for-in': 'off',
        // a leaf value's test sits inline: through a helper, a record's parse/validate ran 2–3.5% slower (measured 2026-11-23)
        'no-nested-ternary': 'off',
        // a field copies its impl's checks: in place would write into the shared impl
        'oxc/no-map-spread': 'off',
        // `test?.(each)` is a nullable boolean, which strict-boolean-expressions refuses
        'typescript/prefer-optional-chain': 'off',
        // a list's output is sized up front: growing it is 2–3× slower
        'unicorn/no-new-array': 'off',
        // GraphQL null is data, distinct from an absent key
        'unicorn/no-null': 'off',

        // `key in Object.prototype` is the check: an inherited accessor such as __proto__
        'unicorn-js/no-computed-property-existence-check': 'off',
        // push's returned length is the index it filled, in the same step
        'unicorn-js/no-return-array-push': 'off',
        // the bounds beside each check sit below 2^53; isSafeInteger made a valid Int list's `is` 55–72% slower (measured 2026-10-22)
        'unicorn-js/prefer-number-is-safe-integer': 'off',

        // counting the keys for…in enumerates binds one it never reads: `_key`, which tsc's noUnusedLocals exempts
        'names/case': ['error', { allow: ['_key'] }],
        'no-unused-vars': ['error', { ...unused, varsIgnorePattern: '^_key$' }],
      },
    },
    // the bench imports src as tests do, and names schemas like the types they validate
    {
      files: ['bench/*.ts'],
      rules: {
        // a point's fields are x and y; an unused index is `_`
        'id-length': 'off',
        // a copy of verax loaded at runtime is typed as the module's own namespace
        'import/no-namespace': ['error', { ignore: ['../src/index.js'] }],
        // the bench sits beside src and measures it, as tests do
        'import/no-relative-parent-imports': 'off',
        // a schema const is named like the type it validates: `const Node = object(…)`
        'names/case': ['error', { allow: ['[A-Z][A-Za-z0-9]*', '__typename'] }],
        // workload sizes and sample counts read clearest as literals where they are used
        'no-magic-numbers': 'off',
        // a round runs one side, or both in alternating order
        'no-nested-ternary': 'off',
        // a fixture's return type is the literal it builds
        'typescript/explicit-function-return-type': 'off',
        // a validator's job is the one assertion the rule forbids: checked `unknown` becomes `T`
        'typescript/no-unsafe-type-assertion': 'off',
        // `x!` and `x as T` are the same claim; no-non-null-assertion keeps the former out
        'typescript/non-nullable-type-assertion-style': 'off',
        // the copy of verax a case runs is handed in as its module namespace
        'typescript/prefer-readonly-parameter-types': 'off',
        // schemas compose by nesting calls: list(nullable(string())) is the DSL
        'unicorn/max-nested-calls': 'off',
        // GraphQL null is data, distinct from an absent key
        'unicorn/no-null': 'off',
      },
    },
    {
      // the docs runner drives the page in a browser
      env: { browser: true },
      files: ['docs/*.ts'],
      // the page's runner is two flat procedures: printing a value, wiring the blocks
      rules: {
        'max-statements': 'off',
        // a validator's job is the one assertion the rule forbids: checked `unknown` becomes `T`
        'typescript/no-unsafe-type-assertion': 'off',
        // a callback's parameters are its callee's; a schema's validate is a method, not state
        'typescript/prefer-readonly-parameter-types': [
          'warn',
          { ignoreInferredTypes: true, treatMethodsAsReadonly: true },
        ],

        // predicates and flags take the domain's words: the API's `is`, a leaf's `test`, `overflow`
        'unicorn-js/consistent-boolean-name': 'off',
      },
    },
    // tests hand verax thenables, holes, non-Error throws and cross-realm promises
    {
      files: ['__tests__/*.ts'],
      rules: {
        // a test's one-letter schema and value names are its fixtures
        'id-length': 'off',
        // fast-check's names collide with verax's; a second copy's type is the module's own
        'import/no-namespace': ['error', { ignore: ['../src/index.js', 'fast-check'] }],
        // tests sit beside src, as in @jlg/oxlint: they import the module under test from ../src
        'import/no-relative-parent-imports': 'off',
        // limits, sizes and edge values are the cases themselves
        'no-magic-numbers': 'off',
        'no-sparse-arrays': 'off',
        'no-throw-literal': 'off',
        // type tests declare schemas read only by `typeof`; a rest destructure omits a key unread
        'no-unused-vars': [
          'error',
          { ...unused, ignoreRestSiblings: true, reportVarsOnlyUsedAsTypes: false },
        ],
        // recursive schemas name themselves inside getters, and the oracle's judges each other
        'no-use-before-define': ['error', { variables: false }],
        // a thunk in a typed table is typed by the table
        'typescript/explicit-function-return-type': 'off',
        // a validator's job is the one assertion the rule forbids: checked `unknown` becomes `T`
        'typescript/no-unsafe-type-assertion': 'off',
        // `x!` and `x as T` are the same claim; no-non-null-assertion keeps the former out
        'typescript/non-nullable-type-assertion-style': 'off',
        'typescript/only-throw-error': 'off',
        // a callback's parameters are its callee's; a schema's validate is a method, not state
        'typescript/prefer-readonly-parameter-types': [
          'warn',
          { ignoreInferredTypes: true, treatMethodsAsReadonly: true },
        ],

        // a schema is named like the type it validates, a scalar like a GraphQL type (`const User = object(…)`), and `__typename` is GraphQL's own union tag
        'names/case': ['error', { allow: ['[A-Z][A-Za-z0-9]*', '__typename'] }],
        // schemas compose by nesting calls: list(nullable(string())) is the DSL
        'unicorn/max-nested-calls': 'off',
        // GraphQL null is data, distinct from an absent key
        'unicorn/no-null': 'off',
        'unicorn/no-thenable': 'off',
        // `literal(undefined)` is a schema of undefined, not a redundant argument
        'unicorn/no-useless-undefined': ['error', { checkArguments: false }],

        // predicates and flags take the domain's words: the API's `is`, a leaf's `test`, `overflow`
        'unicorn-js/consistent-boolean-name': 'off',
        // `def` is the API's word: every schema carries one
        'unicorn-js/name-replacements': ['error', { replacements: { def: false } }],
        // contradicts native unicorn/prefer-number-properties, which demands the Number.NaN it forbids
        'unicorn-js/prefer-global-number-constants': 'off',
      },
    },
    // after the tests block: it turns off what that block only loosens
    {
      files: ['__tests__/property.test.ts'],
      rules: {
        // switch-exhaustiveness-check proves every case; a default would hide a new one
        'default-case': 'off',
        // for-of would run the value's iterator; the oracle reads by index, as verax does
        'typescript/prefer-for-of': 'off',
        // a recipe's transforms shape the array they are handed: holes, extra keys, a cycle
        'typescript/prefer-readonly-parameter-types': 'off',
        'unicorn-js/no-for-loop': 'off',
        // lib is ES2024, which types no iterator helpers
        'unicorn-js/prefer-iterator-helpers': 'off',
        'unicorn-js/prefer-iterator-to-array': 'off',
        // Object.entries reads every value up front; the oracle, like verax, stops at the first failure
        'unicorn-js/prefer-object-iterable-methods': 'off',
        // a try spans the walk it guards: one handler per call, never one per item
        'unicorn-js/try-complexity': 'off',
      },
    },
  ],
});

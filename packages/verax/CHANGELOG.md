# verax

## 0.1.2

- [`9e50e0b`](https://github.com/jgeschwendt/typescript/commit/9e50e0be507cec80fe3a83b9887b8693e469816d)
  `verax`: a ground-up rewrite that replaces the 0.1 API. It targets TypeScript 7+, ships ESM only
  and runs on Node ≥24. Four verbs check a value against a schema: `is`, `assert`, `parse` and
  `validate`. Every schema is a Standard Schema V1, and `sdl()` from `verax/sdl` emits GraphQL SDL
  from them. Validation is bounded in depth and work, and never throws: a hostile value or a
  throwing callback becomes an issue. ([#117](https://github.com/jgeschwendt/typescript/pull/117))
- [`02a4549`](https://github.com/jgeschwendt/typescript/commit/02a45492aad42c1445b4380f0b659add221ca583)
  `verax`: a schema's `~standard.validate` is now typed as synchronous, returning verax's `Result`
  rather than `Result | Promise<Result>`, while the schema stays assignable to `StandardSchemaV1`.
  Three issue messages read better: a required key that is absent says `Expected Int, missing` (an
  explicit `undefined` still says `received undefined`), a nullable leaf names null
  (`Expected Int | null, received "x"`), and an object that is not plain, such as one from another
  realm, is `received non-plain object` instead of `received object`. Code that matches on message
  text should update. ([#120](https://github.com/jgeschwendt/typescript/pull/120))
- [`c612748`](https://github.com/jgeschwendt/typescript/commit/c61274867b1dacb357d7b1370a32f77dd670b067)
  `verax`: `tuple([a, b, …])` accepts an array of exactly those items, each checked against its own
  schema, and infers `[A, B, …]`. A wrong length is one issue, `Expected length 2, received 3`; each
  failing item is reported at its index. `Def` gains `{ kind: 'tuple', of }`, and `sdl()` refuses a
  tuple, as GraphQL has none. ([#125](https://github.com/jgeschwendt/typescript/pull/125))

# verax

> vērāx — truthful.

Runtime types for TypeScript, shaped like GraphQL. Zero dependencies; every schema is a
[Standard Schema](https://standardschema.dev).

[Docs](https://jgeschwendt.github.io/typescript/verax/), every example runnable.

```ts
import { type Infer, enums, id, int, list, nullable, object, parse, string } from 'verax';
import { sdl } from 'verax/sdl';

const Role = enums('Role', ['ADMIN', 'MEMBER']);

const User = object('User', {
  age: nullable(int()),
  bio: nullable(string()),
  id: id(),
  role: Role,
  tags: list(string()),
});

type User = Infer<typeof User>;

const user = parse(input, User); // User, or throws VeraxError with every issue

sdl([User]);

// enum Role {
//   ADMIN
//   MEMBER
// }
//
// type User {
//   age: Int
//   bio: String
//   id: ID!
//   role: Role!
//   tags: [String!]!
// }
```

## Requirements

TypeScript 7+, ESM only, Node ≥22.

## GraphQL leans

- Non-null by default; `nullable` (may be `null`) and `optional` (may be absent) differ.
- Scalars are GraphQL's: `Int` is signed 32-bit, `Float` is finite, `ID` is a string.
- `object` is exact over string keys (JSON data): unknown ones are issues.
- Name types to emit them: `sdl()` throws on unnamed ones and on SDL that would lie.
- An absent field is `optional(nullable(x))` to `sdl()`, as in GraphQL: output refuses a bare
  `optional(x)`, and `{ input: true }` a bare `nullable(x)`.
- A union tags its members as GraphQL does: `__typename: literal('Ping')` in `object('Ping', …)`
  discriminates, and output `sdl()` leaves it out, as `__typename` is implicit in GraphQL.

## Guarantees

For any input, validation never throws and never returns a wrong verdict: a throwing callback,
hostile getter or proxy, or exhausted stack becomes an issue. Every limit fails closed: nesting
past 512 is `Too deep`, work past 10 million steps `Too complex`, and issues stop at 100.
`parse` and `validate` return a snapshot: every object, record and list the schema checks is a
fresh plain one, out of reach of the input's getters, proxies and prototypes.

The [contract](https://jgeschwendt.github.io/typescript/verax/contract.html) states each limit
and how every schema reads a value.

## API

| export                                        | does                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `is` · `assert` · `validate` · `parse`        | guard · assertion · result · output-or-throw     |
| `VeraxError`                                  | thrown by `assert` / `parse`; `.issues` has all  |
| `boolean` · `float` · `id` · `int` · `string` | GraphQL's built-in scalars                       |
| `scalar(name, test)`                          | a custom scalar from a type guard                |
| `literal` · `unknown`                         | escape hatches (no SDL form but `__typename`)    |
| `list` · `nullable` · `optional`              | wrappers                                         |
| `object` · `enums` · `union`                  | composites; pass a name first for SDL            |
| `record(value)`                               | `Record<string, V>`: any keys (no SDL form)      |
| `refine(schema, message, test)`               | narrow the accepted values, keep the type        |
| `coerce(schema, convert)`                     | convert before validating (GraphQL `parseValue`) |
| `sdl(roots, { input? })` from `verax/sdl`     | GraphQL SDL; `input: true` emits `input` types   |
| `Infer` · `Input` (types)                     | a schema's output · input type                   |
| `Schema` · `Issue` · `Def` (types)            | a schema · one issue · a schema's structure      |

# verax

> vērāx — truthful.

Runtime types for TypeScript. Zero dependencies; every schema is a
[Standard Schema](https://standardschema.dev).

```ts
// user.ts
import { type Infer, enums, id, int, list, nullable, object, parse, string } from 'verax';

const Role = enums('Role', ['ADMIN', 'MEMBER']);

export const User = object('User', {
  age: nullable(int()),
  bio: nullable(string()),
  id: id(),
  role: Role,
  tags: list(string()),
});

export type User = Infer<typeof User>;

const user = parse(input, User); // User, or throws VeraxError with every issue
```

The same schema emits its GraphQL SDL:

```ts
import { sdl } from 'verax/sdl';
import { User } from './user.ts';

console.log(sdl([User]));

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

TypeScript 7+, ESM only, Node ≥24.

## Common Ground

- `object` is exact: an unknown key is an issue.
- Non-null by default: `nullable` admits `null`, `optional` an absent key.
- Scalars follow GraphQL: `int()` is signed 32-bit, `float()` finite, `id()` a string.

## Guarantees

- **Never throws.** A throwing callback, a hostile getter or proxy, even an exhausted stack becomes
  an issue.
- **Never guesses.** Past a limit it rejects: 512 levels is `Too deep`, 10 million steps is
  `Too complex`, and issues stop at 100.
- **Returns a snapshot.** `parse` and `validate` build fresh plain data, out of reach of the input's
  getters, proxies and prototypes.

The [contract](https://jgeschwendt.github.io/typescript/verax/contract.html) states every limit and
how each schema reads a value.

## API

### Verbs

| call                      | gives                                 |
| ------------------------- | ------------------------------------- |
| `assert(value, schema)`   | a narrowed `value`, or a `VeraxError` |
| `is(value, schema)`       | `true` or `false`, narrowing `value`  |
| `parse(value, schema)`    | the output, or a `VeraxError`         |
| `validate(value, schema)` | `{ value }` or `{ issues }`           |

A `VeraxError` holds every issue in `.issues`, and lists them in its message.

### Schemas

| call                                                    | accepts                           |
| ------------------------------------------------------- | --------------------------------- |
| `boolean()` · `float()` · `id()` · `int()` · `string()` | the built-in scalars              |
| `coerce(schema, convert)`                               | `schema`, after `convert` runs    |
| `enums(name?, values)`                                  | one of `values`                   |
| `list(schema)`                                          | an array of `schema`              |
| `literal(value)`                                        | exactly `value`                   |
| `nullable(schema)`                                      | `schema` or `null`                |
| `object(name?, shape)`                                  | a plain object of exactly `shape` |
| `optional(schema)`                                      | `schema` or an absent key         |
| `record(schema)`                                        | a plain object with any keys      |
| `refine(schema, message, test)`                         | `schema`, where `test` passes     |
| `scalar(name, test)`                                    | what the type guard `test` passes |
| `union(name?, schemas)`                                 | the first of `schemas` to match   |
| `unknown()`                                             | anything                          |

### Types

| type                             | is                               |
| -------------------------------- | -------------------------------- |
| `Def`                            | a schema's structure, its `.def` |
| `Infer<typeof S>`                | what `parse` returns             |
| `Input<typeof S>`                | what `is` and `assert` narrow to |
| `Issue`                          | `{ message, path }`              |
| `Schema<Output, Input = Output>` | any schema                       |

## SDL

`sdl(roots, { input? })` from `verax/sdl` emits every named type reachable from `roots`, and throws
rather than emit SDL that lies.

- **Name what you emit**: `enums('Role', …)`, `object('User', …)`, `scalar('Date', …)`,
  `union('Event', …)`. `literal`, `record` and `unknown` have no SDL form.
- **A field that may be missing is `optional(nullable(x))`.** Output also takes `nullable(x)`;
  `{ input: true }`, which emits `input` types, does not.
- **A union's members are named objects.** `__typename: literal('Ping')` tags `object('Ping', …)`
  and stays out of the output, as GraphQL implies it.

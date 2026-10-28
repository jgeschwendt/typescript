# verax

> vērāx — truthful.

Runtime types for TypeScript, shaped like GraphQL, zero dependencies under [Standard Schema](https://standardschema.dev).

Docs, every example runnable: [jgeschwendt.github.io/typescript/verax](https://jgeschwendt.github.io/typescript/verax/).

```ts
import { type Infer, enums, id, int, list, nullable, object, parse, string } from 'verax';

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
```

## Requirements

TypeScript 7+ and ESM only (`import`, Node >=22)

## GraphQL leans

- Non-null by default; `nullable` (may be `null`) and `optional` (may be absent) differ.
- Scalars are GraphQL's: `Int` is signed 32-bit, `Float` is finite, `ID` is a string.
- `object` is exact over string keys (JSON data): unknown ones are issues.
- Name types to emit them: `sdl()` throws on unnamed ones and on SDL that would lie.
- Output `sdl()` refuses a bare `optional(x)` field: write `optional(nullable(x))`.
- A union tags its members as GraphQL does: `__typename: literal('Ping')` in `object('Ping', …)`
  discriminates, and output `sdl()` leaves it out — `__typename` is implicit in GraphQL.
- With `{ input: true }` a nullable field must be `optional(nullable(x))`, as in GraphQL.

```ts
import { sdl } from 'verax/sdl';
import { User } from '.';

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

## Guarantees and limits

For any input, validation never throws and never returns a wrong verdict: a throwing callback,
hostile getter or proxy, or exhausted stack becomes an issue. For plain data — what `JSON.parse`
or `structuredClone` produce, shared subtrees and holes included — time and memory are bounded by
the limits below. Every limit fails closed: it is an issue (and `is` is `false`), never an accept.
Other objects cost in proportion to their structure: verax reads only what the schema asks for,
but an engine may step over an object's non-enumerable or symbol keys, uncounted, on every visit.

- Plain objects: `object` and `record` accept an object whose prototype is `Object.prototype` or
  `null`, of this realm — not arrays, dates, class instances, or an object created beneath
  another. Bring another realm's objects over with `structuredClone`; lists from any realm are
  lists.
- `Too deep`: nesting past 512 objects, records and lists, the same on every engine — counted on through
  validations nested in callbacks. A stack exhausted anyway (a deep caller, or a dozen or more
  wrappers per level on a small stack — node's default fits about 18) is an issue too; met by a
  validation nested in a callback, it fails the whole call (`Threw: stack exhausted`, and `is` is
  `false`), whatever the callback made of it. Inside a union `Too deep` fails the member that met
  it; later members are still tried.
- Cycles are not special: a cyclic value is walked like any other, only as far as the schema
  goes. A schema that follows the cycle meets `Too deep`; one that stops before it accepts.
- `Too complex`: work is budgeted in steps. Entering an object, record or list is one, and so is
  each field, key or item it holds, each key its shape lacks, and each union member tried and
  failed — on every attempt, failed union members included, and along every path to a shared
  object; a list that fails counts all its items, read or not (its output was sized for them), and
  a record that fails every key it enumerates — except that a leaf value failing within its
  first 9 keys costs nothing, as a leaf field does. Each pass of a call, with every validation nested
  in its callbacks, may take 10 million steps, whatever a callback made of a verdict. A list of n
  items is n + 1 steps, an object of f fields f + 1 and a record of n keys n + 1: a million rows of
  3 fields is 5 million; a list of 10 million numbers is past it, and so are 100,000 items that
  each fail 99 members of a union tried in turn before one accepts.
- `Too complex`, for waste: failed union members and a nested validation's rejected fast pass
  may exceed 16× the useful steps by a million, no more. A member failing on a leaf field (enum,
  literal, scalar — read before nested ones) or an unknown key wastes nothing: the leaf fields it
  read count toward the 10 million past the first 8, and in a shape of more than 8 leaf fields
  enums and literals are read first — so tried in turn, a discriminant costs one step per member
  tried, wherever its key sorts; found by lookup (see Semantics), one step if no member holds
  its value, whatever the union's width. A member failing later costs one step plus each field it read (and
  what that held), and wastes what it costs past 8; untagged unions whose failures cost under
  16× the match never trip it. Waste that compounds does: a recursive union whose members differ
  only below the recursion tries every path, so input some 20 levels deep is `Too complex` even
  when valid — give its members a discriminant.
- A union that fails for the budget reports `Too complex` at its own path, not where it was met.
  Explaining a failed union tries each member's full check, charged as failed members are, and
  each issue's path is work; an explanation that runs past the budget is undone — the mismatch
  stands — and is the call's last.
- `parse` and `validate` copy each path: an object shared along many paths is copied along
  each, so their memory, like their time, grows with paths — within the budget, up to roughly
  600 MB for one large shared object or record.
- Issues stop at 100, and so does the walk.
- Schemas from elsewhere — another copy of verax, another library speaking Standard Schema — are
  black boxes, run through their synchronous `~standard.validate` with their own depth and budget.
  A result must be an object with an array of `issues` or a `value`; anything else, or a thenable,
  is an issue. Their issue paths become property keys.

## Semantics

- A list is walked by index to its length, holes included. An object reads its shape's keys from
  its own properties — a known key even when non-enumerable — and reports its other own enumerable
  string keys as unknown.
- A record reads every own enumerable string key, in the input's order, and checks its value —
  any key, `__proto__` included; a leaf value that fails wastes nothing, as a leaf field does.
- A key may be absent exactly when its schema accepts `undefined` — `optional(x)`, `unknown()`,
  `literal(undefined)` — and its type is then `key?: T | undefined`.
- A schema has an output and an input type — `coerce` makes the input `unknown`.
- `is` and `assert` narrow to the input type; `parse` returns the output type.
- `is` narrows `false` too: a `number` failing `int()` becomes `never` — guard `unknown`.
- `optional` short-circuits `undefined` before an inner `coerce` runs; write a default
  as `coerce(optional(x), (v) => v ?? d)` — its output type still admits `undefined`.
- A union tries members in order and the first to accept wins. A member stops at its first
  failure, checking leaf fields, then unknown keys, before nested ones — so a discriminant field
  makes recursive unions linear regardless of key order. A member that throws failed, except on
  stack exhaustion (a `RangeError` about the call stack), which fails the whole check.
- A union that rejects says why, in a top-level call only — a validation nested in a callback
  reports the mismatch alone, as its caller's verdict is still open. Tagged — every member an
  `object`, or a `refine` of one (never a `coerce`, which may rewrite the tag), holding a distinct
  literal at one key — it reports the member the value's tag names, or one issue at that key
  naming the tags it accepts: `__typename: Expected "Ping" | "Track", received "Pong"`. Otherwise
  it reports its closest member: of those failing below the value itself and knowing every key
  it holds, the one with the fewest issues, the first on a tie. Only the outermost failing
  untagged union explains itself: comparing members, a union nested in one is taken to pass, and
  in the closest member's issues a nested untagged union is its mismatch, at its path (a tagged
  one still reports its member). When no member qualifies, it is `Expected User, received
  object` (or `Too deep`) at the union's path. A member's throw is its issue, at its path.
- A discriminated union finds its member by lookup: when every member is a verax `object` (not
  refined or coerced) holding a defined `literal` at one key, a distinct value in each (`0` and
  `-0` count as one), read after only built-in leaf fields, the value's key is read once, first,
  and only the member holding it is tried. For plain data the verdict is the one trying each
  would reach — every other member fails at that key. A getter, proxy or callback that changes
  the value mid-check can change the outcome either way: lookup reads the discriminant once. On first use such a union reads every member's shape; a shape getter that
  throws leaves its members tried in turn until it reads — unless it exhausts the stack,
  which fails the check.
- `parse` and `validate` return a snapshot: each field and item is read once, and every
  object, record and list the schema checks is a fresh plain one — objects in shape key order and
  records in the input's, integer-like keys first, as JavaScript does — so no getter, proxy,
  prototype or later mutation of the input reaches the output. Values under `unknown()` or a
  custom scalar — a `coerce` into one included — pass through as they are, so an output may hold
  the input's cyclic references. `is` builds only what a `refine` test must see.
- Rejection costs a second pass: a fast check decides, then a full check collects the issues —
  so on invalid input `refine`/`coerce` callbacks and input getters run again, and inside a
  union once per member tried — then, to explain a union that rejects, once more per member
  compared and again for the closest.
- Schemas come from verax's factories; a spread or copy of one is that schema. A Standard Schema
  from elsewhere nests as a field, list item, union member, or under `nullable`/`optional`, typed
  by its own `~standard.types`; `refine`, `coerce` and `sdl()` need verax's own.

## Recursive schemas

Make the field a getter and annotate the schema with its type, which TypeScript cannot infer
through a cycle — a bare `Schema` infers `unknown`. The shape is read once, on first use: its
getters run then, `def.shape` is a frozen copy, and later changes to the object passed in
have no effect.

```ts
import type { Schema } from 'verax';

type Node = {
  next: Node | null;
  note?: string | undefined;
};

const Node: Schema<Node> = object('Node', {
  get next() {
    return nullable(Node);
  },
  note: optional(string()),
});
```

## API

| export                                        | does                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `is` · `assert` · `validate` · `parse`        | guard · assertion · result · output-or-throw     |
| `VeraxError`                                  | thrown by `assert` / `parse`; `.issues` has all  |
| `Infer` · `Input` (types)                     | a schema's output · input type                   |
| `boolean` · `float` · `id` · `int` · `string` | GraphQL's built-in scalars                       |
| `scalar(name, test)`                          | a custom scalar from a type guard                |
| `literal` · `unknown`                         | escape hatches (no SDL form but `__typename`)    |
| `list` · `nullable` · `optional`              | wrappers                                         |
| `object` · `enums` · `union`                  | composites; pass a name first for SDL            |
| `record(value)`                               | `Record<string, V>`: any keys (no SDL form)      |
| `refine(schema, message, test)`               | narrow the accepted values, keep the type        |
| `coerce(schema, convert)`                     | convert before validating (GraphQL `parseValue`) |
| `sdl(roots, { input? })` from `verax/sdl`     | GraphQL SDL; `input: true` emits `input` types   |

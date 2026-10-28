// verax — use cases. Every builder and verb, in the places verax gets used:
// control flow, tests, fetch bodies and form data. Runs with `bun examples/use-cases.ts`.
import {
  type Infer,
  type Input,
  type Schema,
  type StandardSchemaV1,
  VeraxError,
  assert,
  boolean,
  coerce,
  enums,
  float,
  id,
  int,
  is,
  list,
  literal,
  nullable,
  object,
  optional,
  parse,
  record,
  refine,
  scalar,
  string,
  union,
  unknown,
  validate,
} from '../src/index.js';
import { sdl } from '../src/sdl.js';

// ─── leaves ──────────────────────────────────────────────────────────────────────────────────────

const Leaves = object({
  flag: boolean(), // true | false
  id: id(), // GraphQL ID: a string
  kind: literal('post'), // exactly 'post' (Object.is)
  meta: unknown(), // anything, passed through as-is
  n: int(), // signed 32-bit integer
  price: float(), // any finite number
  role: enums('Role', ['ADMIN', 'MEMBER']), // one of, named for sdl()
  title: string(),
});

// a custom scalar: a name plus a type guard
const Email = scalar('Email', (v): v is string => typeof v === 'string' && v.includes('@'));

// ─── wrappers ────────────────────────────────────────────────────────────────────────────────────

const Profile = object('Profile', {
  age: refine(int(), 'Expected an adult', (n) => n >= 18), // narrow, keep the type
  bio: nullable(string()), // present, may be null
  email: Email,
  nickname: optional(string()), // may be absent
  tags: list(string()),
});

// Infer is the output type, Input what `is` and `assert` narrow to
export type Profile = Infer<typeof Profile>;
// { age: number; bio: string | null; email: string; nickname?: string | undefined; tags: string[] }
export type ProfileInput = Input<typeof Profile>;

// ─── record: Record<string, V>, any keys, every value checked ────────────────────────────────────

const Scores = record(int()); // Record<string, number>
const Headers = record(string());
const Payload = record(unknown()); // Record<string, unknown>

// ─── coerce: convert before validating (defaults, form strings) ──────────────────────────────────

const Page = coerce(optional(int()), (v) => v ?? 1); // default 1
const Count = coerce(int(), (v) => (typeof v === 'string' ? Number(v) : v)); // "3" → 3
const When = coerce(
  scalar('DateTime', (v): v is Date => v instanceof Date && !Number.isNaN(v.getTime())),
  (v) => (typeof v === 'string' ? new Date(v) : v),
);

// ─── a named object, a discriminated union, recursion ────────────────────────────────────────────

const User = object('User', {
  created: When,
  id: id(),
  name: string(),
  role: enums('Role', ['ADMIN', 'MEMBER']),
});

const Ping = object('Ping', { __typename: literal('Ping'), at: int() });
const Track = object('Track', { __typename: literal('Track'), count: Count, event: string() });
const Message = union('Message', [Ping, Track]); // one read of `__typename` picks the member

// recursive: a getter field, and an explicit annotation (TS can't infer through a cycle)
type Comment = {
  replies: Comment[];
  text: string;
};
const Comment: Schema<Comment> = object('Comment', {
  get replies() {
    return list(Comment);
  },
  text: string(),
});

// ─── control flow ────────────────────────────────────────────────────────────────────────────────

const handle = (data: unknown): string => {
  switch (true) {
    case is(data, Ping): {
      return 'pong';
    }
    case is(data, Track): {
      return `tracked ${data.event}`; // narrowed
    }
    default: {
      assert(data, User); // throws VeraxError listing every issue
      return `hello ${data.name}`;
    }
  }
};

// ─── the four verbs ──────────────────────────────────────────────────────────────────────────────

const body: unknown = { created: '2026-10-01T00:00:00Z', id: 'u1', name: 'Ada', role: 'ADMIN' };

is(body, User); // false here: `created` is a string; is() never converts
const user = parse(body, User); // { …, created: Date }, a fresh snapshot, coerced
const result = validate({ id: 1 }, User); // { issues: [...] }, never throws
if (result.issues) {
  for (const { message, path } of result.issues) {
    console.log(path.join('.') || '(root)', message);
  }
}
try {
  assert({ id: 'u1' }, User);
} catch (error) {
  if (error instanceof VeraxError) {
    console.log(error.message); // "name: Expected String, received undefined\n…"
  }
}

// ─── fetch bodies ────────────────────────────────────────────────────────────────────────────────

export const getUser = async (url: string): Promise<Infer<typeof User>> => {
  const response = await fetch(url);
  return parse(await response.json(), User);
};

// ─── form data: Object.fromEntries, then coerce the strings ──────────────────────────────────────

const Signup = object('Signup', {
  age: coerce(int(), Number),
  email: Email,
  newsletter: coerce(boolean(), (v) => v === 'on'),
});
const form = new FormData();
form.set('email', 'ada@example.com');
form.set('age', '36');
form.set('newsletter', 'on');
const signup = parse({ newsletter: undefined, ...Object.fromEntries(form.entries()) }, Signup);

// ─── tests (bun:test, node:test): assert throws, the runner prints the issues ────────────────────
//
//   test('GET /users/1', async () => {
//     const res = await app.request('/users/1');
//     assert(await res.json(), User);
//   });

// ─── Standard Schema: hand any schema to tRPC, Hono, TanStack Form… ──────────────────────────────

const standard: StandardSchemaV1 = User;
const checked = await standard['~standard'].validate(body);

// ─── GraphQL SDL from the same schemas ───────────────────────────────────────────────────────────

// `__typename` is implicit in SDL: Ping and Track list their other fields
console.log(sdl([User, Comment, Message]));

// ─── run it ──────────────────────────────────────────────────────────────────────────────────────

console.log(
  handle({ __typename: 'Ping', at: 1 }),
  '|',
  handle({ __typename: 'Track', count: '2', event: 'open' }),
);
console.log(
  is({ ada: 3, lin: 5 }, Scores),
  is({ ada: '3' }, Scores),
  parse({ a: 'x' }, Headers),
  is({ any: [1] }, Payload),
);
console.log(
  user.created instanceof Date,
  signup,
  parse({ replies: [{ replies: [], text: 'yo' }], text: 'hi' }, Comment),
);
console.log(
  is(
    { flag: true, id: 'x', kind: 'post', meta: null, n: 1, price: 1.5, role: 'MEMBER', title: 't' },
    Leaves,
  ),
);
console.log(
  parse({ age: 20, bio: null, email: 'a@b.c', tags: [] }, Profile),
  parse(undefined, Page),
  'issues' in checked,
);

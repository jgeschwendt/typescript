import { describe, expect, test } from 'bun:test';
import {
  type Def,
  type Infer,
  type Input,
  type ObjectOf,
  type Optional,
  type Schema,
  type Shape,
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

const Role = enums('Role', ['ADMIN', 'MEMBER']);
const DateTime = coerce(
  scalar(
    'DateTime',
    (value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()),
  ),
  (value) => (typeof value === 'string' ? new Date(value) : value),
);
const userShape = {
  age: nullable(int()),
  bio: optional(string()),
  createdAt: DateTime,
  id: id(),
  role: Role,
  tags: list(string()),
};
const User = object('User', userShape);

const alice = {
  age: 33,
  createdAt: '2026-09-26T00:00:00Z',
  id: 'u1',
  role: 'ADMIN',
  tags: ['a'],
};

// Type-level: `tsc --noEmit` fails the package test script if inference drifts.
type Equal<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? true
    : false
  : false;
true satisfies Equal<
  Infer<typeof User>,
  {
    age: number | null;
    bio?: string | undefined;
    createdAt: Date;
    id: string;
    role: 'ADMIN' | 'MEMBER';
    tags: string[];
  }
>;
true satisfies Equal<StandardSchemaV1.InferOutput<typeof Role>, 'ADMIN' | 'MEMBER'>;
true satisfies Equal<
  ObjectOf<{ name: Optional<number>; note: Schema<Date, string> }, 'input'>,
  { name?: number | undefined; note: string }
>;
true satisfies Equal<Extract<Def, { kind: 'scalar' }>['name'], string>;
true satisfies Equal<Shape, Readonly<Record<string, StandardSchemaV1>>>;

describe('scalars', () => {
  test('Int is a signed 32-bit integer', () => {
    expect(is(2 ** 31 - 1, int())).toBe(true);
    expect(is(2 ** 31, int())).toBe(false);
    expect(is(-(2 ** 31), int())).toBe(true);
    expect(is(-(2 ** 31) - 1, int())).toBe(false);
    expect(is(1.5, int())).toBe(false);
  });
  test('Float rejects non-finite', () => {
    expect(is(1.5, float())).toBe(true);
    expect(is(Number.NaN, float())).toBe(false);
    expect(is(Number.POSITIVE_INFINITY, float())).toBe(false);
  });
  test('Boolean, literal', () => {
    expect(is(false, boolean())).toBe(true);
    expect(is('x', literal('x'))).toBe(true);
    expect(is('y', literal('x'))).toBe(false);
  });
});

const messages = (value: unknown, against: Schema): string[] | undefined =>
  validate(value, against).issues?.map((found) => found.message);

describe('issue messages', () => {
  test('scalars name the expected type and describe the received value', () => {
    expect(messages(null, boolean())).toEqual(['Expected Boolean, received null']);
    expect(messages(1n, float())).toEqual(['Expected Float, received 1n']);
    expect(messages(1.5, id())).toEqual(['Expected ID, received 1.5']);
    expect(messages('x', int())).toEqual(['Expected Int, received "x"']);
    expect(messages(() => 1, string())).toEqual(['Expected String, received function']);
    expect(messages([], string())).toEqual(['Expected String, received list']);
    expect(messages({}, string())).toEqual(['Expected String, received object']);
    expect(messages(Symbol('s'), string())).toEqual(['Expected String, received Symbol(s)']);
    expect(messages(undefined, string())).toEqual(['Expected String, received undefined']);
  });
  test('literal renders both sides; -0 and bigint stay distinct', () => {
    expect(messages(-0, literal(0))).toEqual(['Expected 0, received -0']);
    expect(messages(1, literal(1n))).toEqual(['Expected 1n, received 1']);
  });
  test('composites use their name, or a generic label', () => {
    expect(messages('X', enums(['A', 'B']))).toEqual(['Expected one of A | B, received "X"']);
    expect(messages('OWNER', Role)).toEqual(['Expected Role: ADMIN | MEMBER, received "OWNER"']);
    expect(messages(1, list(int()))).toEqual(['Expected list, received 1']);
    expect(messages(1, object({}))).toEqual(['Expected object, received 1']);
    expect(messages(1, object('Named', {}))).toEqual(['Expected Named, received 1']);
    expect(messages({ extra: 1 }, object({}))).toEqual(['Unknown field on object']);
    expect(messages({ extra: 1 }, object('Named', {}))).toEqual(['Unknown field on Named']);
    expect(messages(1, union([string()]))).toEqual(['Expected union member, received 1']);
    expect(messages(1, union('Named', [string()]))).toEqual(['Expected Named, received 1']);
  });
  test('a value that throws when described is "value"', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(messages(proxy, string())).toEqual(['Expected String, received value']);
  });
  test('a thrown non-Error is described', () => {
    const Throws = scalar('Throws', (value): value is never => {
      throw String(value);
    });
    expect(messages(1, Throws)).toEqual(['Threw: "1"']);
  });
});

describe('object', () => {
  test('parses, coercing custom scalars', () => {
    const user = parse(alice, User);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect('bio' in user).toBe(false);
    expect('bio' in parse({ ...alice, bio: undefined }, User)).toBe(true);
  });
  test('non-null by default; nullable and optional are distinct', () => {
    expect(is({ ...alice, age: null }, User)).toBe(true);
    expect(is({ ...alice, age: undefined }, User)).toBe(false);
    expect(is({ ...alice, bio: undefined }, User)).toBe(true);
    expect(is({ ...alice, bio: null }, User)).toBe(false);
  });
  test('rejects unknown fields, reporting every issue with a path', () => {
    const result = validate({ ...alice, extra: 1, role: 'OWNER', tags: [1] }, User);
    expect(result.issues?.map((found) => found.path)).toEqual([['role'], ['tags', 0], ['extra']]);
  });
});

const Counts = record(int());
true satisfies Equal<Infer<typeof Counts>, Record<string, number>>;
const Bag = record(unknown());
true satisfies Equal<Infer<typeof Bag>, Record<string, unknown>>;
const Dates = record(DateTime);
true satisfies Equal<Infer<typeof Dates>, Record<string, Date>>;
true satisfies Equal<Input<typeof Dates>, Record<string, unknown>>;

describe('record', () => {
  test('a plain object of any string keys, each value checked', () => {
    expect(is({}, Counts)).toBe(true);
    expect(is({ a: 1, b: 2 }, Counts)).toBe(true);
    expect(is(Object.create(null), Counts)).toBe(true);
    expect(is({ a: 1, b: 'x' }, Counts)).toBe(false);
    expect(is([], Counts)).toBe(false);
    expect(is(new Date(), Counts)).toBe(false);
    expect(is(null, Counts)).toBe(false);
    expect(is(Object.create({ a: 1 }), Counts)).toBe(false);
    expect(is({ a: 'anything', b: [{}] }, Bag)).toBe(true);
  });
  test('reports every value that fails at its key', () => {
    expect(validate({ a: 1, b: 'x', c: { d: 2 } }, Counts).issues).toEqual([
      { message: 'Expected Int, received "x"', path: ['b'] },
      { message: 'Expected Int, received object', path: ['c'] },
    ]);
    expect(validate({ a: { n: 1 }, b: { n: 'x' } }, record(object({ n: int() }))).issues).toEqual([
      { message: 'Expected Int, received "x"', path: ['b', 'n'] },
    ]);
    expect(validate([1], Counts).issues).toEqual([
      { message: 'Expected record, received list', path: [] },
    ]);
  });
  test('reads only own enumerable string keys', () => {
    const value: Record<string, unknown> = { a: 1 };
    Object.defineProperties(value, {
      hidden: { enumerable: false, value: 'x' },
      [Symbol('s')]: { enumerable: true, value: 'x' },
    });
    expect(parse(value, Counts)).toEqual({ a: 1 });
  });
  test('parse is a fresh plain snapshot, coercions applied, each value read once', () => {
    let reads = 0;
    const value = {
      get at() {
        reads += 1;
        return '2026-10-01T00:00:00Z';
      },
    };
    const out = parse(value, Dates);
    expect(reads).toBe(1);
    expect(out['at']).toBeInstanceOf(Date);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    const input = { a: 1 };
    expect(parse(input, Counts)).not.toBe(input);
    expect(Object.getPrototypeOf(parse(Object.create(null), Counts))).toBe(Object.prototype);
  });
  test('__proto__ and prototype-named keys stay own keys', () => {
    const out = parse(JSON.parse('{"__proto__":1,"constructor":2,"toString":3}'), Counts);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.keys(out)).toEqual(['__proto__', 'constructor', 'toString']);
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toBe(1);
    expect(is(JSON.parse('{"__proto__":"x"}'), Counts)).toBe(false);
  });
  test('nests: under object, list, nullable, union, and itself', () => {
    const Nested = record(record(list(int())));
    expect(is({ a: { b: [1, 2] } }, Nested)).toBe(true);
    expect(validate({ a: { b: [1, 'x'] } }, Nested).issues).toEqual([
      { message: 'Expected Int, received "x"', path: ['a', 'b', 1] },
    ]);
    const Either = union([record(string()), record(int())]);
    expect(parse({ a: 1 }, Either)).toEqual({ a: 1 });
    expect(is({ a: 1, b: 'x' }, Either)).toBe(false);
    expect(is(null, nullable(Counts))).toBe(true);
  });
});

describe('union, refine', () => {
  const Shape = union('Shape', [
    object('Circle', { radius: float() }),
    object('Square', { side: float() }),
  ]);
  test('first accepting member wins', () => {
    expect(is({ radius: 1 }, Shape)).toBe(true);
    expect(is({ side: 1 }, Shape)).toBe(true);
    expect(is({ radius: 1, side: 1 }, Shape)).toBe(false);
  });
  test('refine runs only after the inner schema passes', () => {
    const Positive = refine(int(), 'Expected a positive Int', (count) => count > 0);
    expect(validate(-1, Positive).issues?.[0]?.message).toBe('Expected a positive Int');
    expect(validate('x', Positive).issues).toHaveLength(1);
  });
});

describe('assert', () => {
  test('narrows, and throws VeraxError with issues', () => {
    const value: unknown = 'u1';
    assert(value, id());
    true satisfies Equal<typeof value, string>;
    expect(() => {
      assert(1, id());
    }).toThrow(VeraxError);
  });
  test('VeraxError is a TypeError: one path-prefixed line per issue', () => {
    const Nested = object({ name: string(), note: object({ text: string() }) });
    const bad = { name: 1, note: { text: 2 } };
    expect(() => parse(bad, Nested)).toThrow(TypeError);
    expect(() => parse(bad, Nested)).toThrow(
      expect.objectContaining({
        issues: validate(bad, Nested).issues,
        message: 'name: Expected String, received 1\nnote.text: Expected String, received 2',
        name: 'VeraxError',
      }),
    );
  });
});

describe('Standard Schema', () => {
  test('~standard.validate matches validate', async () => {
    const std: StandardSchemaV1 = User;
    expect(std['~standard'].vendor).toBe('verax');
    expect(std['~standard'].version).toBe(1);
    expect(await std['~standard'].validate(alice)).toEqual(validate(alice, User));
    const bad = { ...alice, id: 1 };
    expect(await std['~standard'].validate(bad)).toEqual(validate(bad, User));
  });
});

describe('sdl', () => {
  test('emits named types, alpha-sorted', () => {
    const Post = object('Post', {
      // A response sends null, never omits: output SDL needs nullable, not optional.
      author: object('User', { ...userShape, bio: nullable(string()) }),
      body: nullable(string()),
      tags: list(nullable(string())),
    });
    expect(sdl([Post])).toBe(
      [
        'scalar DateTime',
        'type Post {\n  author: User!\n  body: String\n  tags: [String]!\n}',
        'enum Role {\n  ADMIN\n  MEMBER\n}',
        'type User {\n  age: Int\n  bio: String\n  createdAt: DateTime!\n  id: ID!\n  role: Role!\n  tags: [String!]!\n}',
      ].join('\n\n'),
    );
  });
  test('input mode', () => {
    expect(sdl([object('Filter', { query: string() })], { input: true })).toBe(
      'input Filter {\n  query: String!\n}',
    );
    expect(
      sdl([object('Filter', { query: nullable(optional(string())) })], {
        input: true,
      }),
    ).toBe('input Filter {\n  query: String\n}');
  });
  test('what GraphQL cannot express', () => {
    expect(() => sdl([object({ query: string() })])).toThrow(
      'sdl: objects must be named — object(name, …)',
    );
    expect(() => sdl([enums(['A'])])).toThrow('sdl: enums must be named — enums(name, …)');
    expect(() => sdl([union([User])])).toThrow('sdl: unions must be named — union(name, …)');
    expect(() => sdl([literal(1)])).toThrow('sdl: literal() has no GraphQL equivalent');
    expect(() => sdl([unknown()])).toThrow('sdl: unknown() has no GraphQL equivalent');
    expect(() => sdl([object('Bag', { counts: record(int()) })])).toThrow(
      'sdl: record() has no GraphQL equivalent',
    );
    expect(() => sdl([union('Named', [User])], { input: true })).toThrow(
      'sdl: GraphQL input types cannot be unions',
    );
    expect(() => sdl([optional(string())], { input: true })).toThrow(
      'sdl: only input fields can be optional',
    );
    expect(() =>
      sdl([object('Item', { tags: list(optional(string())) })], {
        input: true,
      }),
    ).toThrow('sdl: only input fields can be optional');
    expect(() => sdl([enums('Named', ['null'])])).toThrow('sdl: enum value null is reserved');
    expect(() => sdl([enums('Named', ['a-b'])])).toThrow(
      'sdl: "a-b" is not a valid GraphQL enum value name',
    );
  });
  test('an own-name __typename literal is the implicit union tag', () => {
    const Ping = object('Ping', { __typename: literal('Ping'), at: int() });
    const Track = object('Track', { __typename: literal('Track'), event: string() });
    const Message = union('Message', [Ping, Track]);
    expect(sdl([Message])).toBe(
      'union Message = Ping | Track\n\ntype Ping {\n  at: Int!\n}\n\ntype Track {\n  event: String!\n}',
    );
    expect(is({ __typename: 'Track', event: 'open' }, Message)).toBe(true);
    expect(is({ at: 1 }, Message)).toBe(false);
    expect(() => sdl([object('Pong', { __typename: literal('Ping'), at: int() })])).toThrow(
      'not a valid GraphQL field name',
    );
    expect(() => sdl([Ping], { input: true })).toThrow('not a valid GraphQL field name');
    expect(() => sdl([object('Tag', { __typename: literal('Tag') })])).toThrow('has no fields');
  });
  test('recursion, nested lists, input list items, no roots', () => {
    const Linked: Schema = object('Linked', {
      get next() {
        return nullable(Linked);
      },
    });
    expect(sdl([Linked])).toBe('type Linked {\n  next: Linked\n}');
    expect(sdl([object('Grid', { cells: list(list(int())) })])).toBe(
      'type Grid {\n  cells: [[Int!]!]!\n}',
    );
    expect(
      sdl([object('Item', { tags: list(nullable(string())) })], {
        input: true,
      }),
    ).toBe('input Item {\n  tags: [String]!\n}');
    expect(sdl([])).toBe('');
  });
});

// One test per defect confirmed by the 2026-09-26 gigasweep; `#n` is its finding id.
import { describe, expect, test } from 'bun:test';
import { type Equal, beneath, chain, copy, paths, trap } from './_helpers.js';
import { impl, depth as stackDepth } from '../src/core.js';
import {
  type Infer,
  type Input,
  type Issue,
  type Schema,
  type StandardSchemaV1,
  coerce,
  enums,
  int,
  is,
  list,
  literal,
  nullable,
  object,
  optional,
  parse,
  refine,
  scalar,
  string,
  union,
  unknown,
  validate,
} from '../src/index.js';
import { sdl } from '../src/sdl.js';

/**
An object schema built from entries: key order is the variable under test.
*/
const ordered = (...entries: [string, Schema][]): Schema => object(Object.fromEntries(entries));

describe('object keys are own keys', () => {
  test('#0 prototype-named extra keys are unknown fields', () => {
    const Named = object({ name: string() });
    expect(paths(validate({ constructor: 1, name: 'x', toString: 2 }, Named))).toEqual([
      ['constructor'],
      ['toString'],
    ]);
    expect(is(JSON.parse('{"name":"x","__proto__":{"admin":true}}'), Named)).toBe(false);
  });
  test('#1 absent prototype-named fields are absent; inherited values do not count', () => {
    const Inherited = object({
      constructor: optional(string()),
      toString: optional(string()),
    });
    expect(validate({}, Inherited).issues).toBeUndefined();
    expect(Object.hasOwn(parse({}, object({ constructor: unknown() })), 'constructor')).toBe(false);
    expect(is(Object.create({ name: 'x' }), object({ name: string() }))).toBe(false);
  });
  test('#7 a "__proto__" field is a field, not a prototype swap', () => {
    const shape: Record<string, Schema> = {};
    Object.defineProperty(shape, '__proto__', {
      enumerable: true,
      value: string(),
    });
    const out = parse(JSON.parse('{"__proto__":"v"}'), object(shape)) as object;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toBe('v');
  });
  test('#8 only plain objects are objects', () => {
    const Empty = object({});
    expect(is(new Date(), Empty)).toBe(false);
    expect(is(new Map(), Empty)).toBe(false);
    class Instance {
      public readonly tag = 1;
    }
    expect(is(new Instance(), Empty)).toBe(false);
    expect(is(Object.create(null), Empty)).toBe(true);
    // An object of another realm is not plain here (structuredClone brings it over); a list is.
    const { runInNewContext } = process.getBuiltinModule('node:vm');
    const alien: unknown = runInNewContext('({ name: "x" })');
    expect(is(alien, object({ name: string() }))).toBe(false);
    expect(is(structuredClone(alien), object({ name: string() }))).toBe(true);
    expect(is(runInNewContext('["x"]'), list(string()))).toBe(true);
  });
});

describe('absent keys', () => {
  test('#2 a value produced for an absent key is kept', () => {
    const Defaulted = object({
      name: coerce(string(), (raw) => raw ?? 'dflt'),
    });
    expect(parse({}, Defaulted)).toEqual({ name: 'dflt' });
  });
  test('#3 refine and coerce keep a key optional', () => {
    const Wrapped = object({
      name: refine(optional(string()), 'short', (text) => (text ?? '').length < 3),
      note: coerce(optional(int()), (raw) => (raw === undefined ? raw : Number(raw))),
    });
    true satisfies Equal<
      Infer<typeof Wrapped>,
      { name?: string | undefined; note?: number | undefined }
    >;
    expect(is({}, Wrapped)).toBe(true);
  });
});

describe('verb types', () => {
  test('#4 is/assert narrow to the input type; coerce widens it to unknown', () => {
    const Coerced = object({ count: coerce(int(), Number), label: string() });
    // `unknown` admits `undefined`, so the key may be absent on the input side.
    true satisfies Equal<Input<typeof Coerced>, { count?: unknown; label: string }>;
    true satisfies Equal<Infer<typeof Coerced>, { count: number; label: string }>;
  });
  test('#29 Standard Schema InferInput is the input type', () => {
    const Plain = object({ count: int() });
    true satisfies Equal<StandardSchemaV1.InferInput<typeof Plain>, { count: number }>;
  });
});

describe('lists and hostile input', () => {
  const Throws = scalar('Throws', (value): value is never => {
    throw new Error(String(value));
  });
  test('#5 holes are validated', () => {
    expect(paths(validate([1, , 3], list(int())))).toEqual([[1]]);
  });
  test('#6 the input’s own methods never run', () => {
    const items = [1, 'x'];
    Object.defineProperty(items, 'map', { value: () => [1, 2] });
    expect(is(items, list(int()))).toBe(false);
  });
  test('#9 #10 throws become issues at their path', () => {
    const boom = {
      get name(): string {
        throw new Error('getter');
      },
    };
    expect(validate(boom, object({ name: string() }))).toEqual({
      issues: [{ message: 'Threw: getter', path: ['name'] }],
    });
    expect(validate({ item: 1 }, object({ item: Throws })).issues?.[0]?.path).toEqual(['item']);
    expect(is(1, union([Throws, int()]))).toBe(true);
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(is(proxy, object({}))).toBe(false);
  });
  test('#9 a throwing member leaves path and depth as it found them; every callback is guarded', () => {
    expect(
      validate({ inner: { item: 1 } }, object({ inner: union([object({ item: Throws })]) })).issues,
    ).toEqual([{ message: 'Threw: 1', path: ['inner', 'item'] }]);
    expect(
      is(
        [{ item: 1 }, { item: 1 }],
        list(union([object({ item: Throws }), object({ item: int() })])),
      ),
    ).toBe(true);
    expect(
      validate(
        1,
        coerce(int(), () => {
          throw new Error('from');
        }),
      ).issues,
    ).toEqual([{ message: 'Threw: from', path: [] }]);
    expect(
      validate(
        1,
        refine(int(), 'r', () => {
          throw new Error('test');
        }),
      ).issues,
    ).toEqual([{ message: 'Threw: test', path: [] }]);
  });
  test('#11 long strings are truncated in messages', () => {
    expect(validate('x'.repeat(10_000), int()).issues).toEqual([
      { message: `Expected Int, received "${'x'.repeat(40)}…"`, path: [] },
    ]);
    expect(validate('x'.repeat(40), int()).issues?.[0]?.message).toBe(
      `Expected Int, received "${'x'.repeat(40)}"`,
    );
  });
  test('a leaf list reports a throw at its item, after earlier faults', () => {
    let calls = 0;
    const Late = scalar('Late', (value): value is number => {
      calls += 1;
      if (value === 3 && calls > 1) {
        throw new Error('late');
      }
      return value === 1;
    });
    expect(validate([2, 1, 3], list(nullable(Late))).issues).toEqual([
      { message: 'Expected Late, received 2', path: [0] },
      { message: 'Threw: late', path: [2] },
    ]);
  });
  test('a throw while reading a list reports at the list or its item', () => {
    for (const Items of [list(int()), list(list(int()))]) {
      const Holder = object({ items: Items });
      expect(validate({ items: new Proxy([[]], trap('length')) }, Holder).issues).toEqual([
        { message: 'Threw: length', path: ['items'] },
      ]);
      expect(validate({ items: new Proxy([[]], trap('0')) }, Holder).issues).toEqual([
        { message: 'Threw: 0', path: ['items', 0] },
      ]);
    }
  });
  test('messages quote strings exactly as JSON does', () => {
    const samples = ['', 'a b', '"', '\\', '\n', '\u{7F}', 'é', '\u{D800}', '😀'];
    for (let code = 0; code < 0x80; code += 1) {
      samples.push(`x${String.fromCodePoint(code)}y`);
    }
    for (const sample of samples) {
      expect(validate(sample, int()).issues?.[0]?.message).toBe(
        `Expected Int, received ${JSON.stringify(sample)}`,
      );
    }
  });
  test('#12 literal compares with Object.is', () => {
    expect(is(Number.NaN, literal(Number.NaN))).toBe(true);
    expect(is(-0, literal(0))).toBe(false);
  });
});

describe('recursion', () => {
  test('#20 a schema that follows a cycle stops at the depth limit, not a stack overflow', () => {
    interface Node {
      next: Node | null;
    }
    const Linked: Schema<Node> = object({
      get next() {
        return nullable(Linked);
      },
    });
    const node: Node = { next: null };
    node.next = node;
    // What structuredClone makes of it is plain data, and walks the same.
    const cloned = structuredClone(node);
    expect(cloned.next).toBe(cloned);
    for (const value of [node, cloned]) {
      expect(is(value, Linked)).toBe(false);
      expect(validate(value, Linked).issues).toEqual([
        {
          message: 'Too deep',
          path: Array.from({ length: 512 }, () => 'next'),
        },
      ]);
    }
    expect(stackDepth()).toBe(0);
  });
  test('#20 a cycle is not special: a schema that stops before it accepts, and its output may hold it', () => {
    const loop: unknown[] = [];
    loop.push(loop);
    expect(parse(loop, list(list(unknown())))).toEqual([[loop]]);
    const node: { name: string; self?: unknown } = { name: 'x' };
    node.self = node;
    const cloned = structuredClone(node);
    const Named = object({
      name: string(),
      self: object({ name: string(), self: unknown() }),
    });
    for (const value of [node, cloned]) {
      expect(is(value, Named)).toBe(true);
      const out = parse(value, Named);
      expect(out).not.toBe(value);
      expect(out.self).not.toBe(value);
      expect(out.self.self).toBe(value);
    }
  });
  test('#20 a shared but acyclic reference (a diamond) is not a cycle', () => {
    const shared = { name: 'x' };
    const Leaf = object({ name: string() });
    expect(is({ left: shared, right: shared }, object({ left: Leaf, right: Leaf }))).toBe(true);
  });
});

// Defects confirmed by the 2026-09-26 gigareview; `r#n` is its finding index.
describe('unions try every member, every time', () => {
  // A value that is its own `self`: Walks follows it one level further than Flat.
  const Flat = union([object({ self: unknown(), tag: string() })]);
  const Walks = object({ self: Flat, tag: string() });
  const cyclic: { self?: unknown; tag: string } = { tag: 'a' };
  cyclic.self = cyclic;
  const pair = { first: cyclic, second: cyclic };
  test('r#4 key order does not change the verdict', () => {
    const Either = union([Walks, unknown()]);
    expect(is(pair, ordered(['first', Either], ['second', Flat]))).toBe(true);
    expect(is(pair, ordered(['second', Flat], ['first', Either]))).toBe(true);
    expect(validate(pair, ordered(['first', Walks], ['second', Flat])).issues).toBeUndefined();
    expect(validate(pair, ordered(['second', Flat], ['first', Walks])).issues).toBeUndefined();
  });
  test('r#19 a discarded attempt cannot poison a later member', () => {
    const Leaf = object({ leaf: unknown() });
    const Inner = union([object({ down: Leaf })]);
    const First = object({ head: object({ leaf: Inner }), tail: literal(0) });
    const Second = object({ head: unknown(), tail: Inner });
    const lower: { down?: unknown } = {};
    const upper = { leaf: lower };
    lower.down = upper;
    const value = { head: upper, tail: lower };
    expect(is(value, Second)).toBe(true);
    expect(is(value, union([First, Second]))).toBe(true);
  });
  test('r#10 union([X]) accepts what X accepts at the same position', () => {
    const Back = object({ back: object({ loop: unknown() }) });
    const Narrow = union([Back]);
    const Wide = union([object({ loop: Narrow }), object({ loop: unknown() })]);
    const outer: { loop?: unknown } = {};
    const inner = { back: outer };
    outer.loop = inner;
    const value = { head: outer, tail: inner };
    expect(is(value, object({ head: Wide, tail: Back }))).toBe(true);
    expect(is(value, object({ head: Wide, tail: Narrow }))).toBe(true);
  });
  test('r#11 H2 outputs are fresh: no object or list of the input is returned', () => {
    const Tagged = object({ tags: list(string()) });
    const shared = { tags: ['b', 'a'] };
    const [left, right] = parse([shared, shared], list(union([Tagged])));
    expect(left).toEqual(shared);
    expect(left).not.toBe(shared);
    expect(left?.tags).not.toBe(shared.tags);
    expect(right).toEqual(shared);
    const Counted = object({
      count: coerce(int(), Number),
      tags: list(string()),
    });
    const input = { count: '1', tags: ['a'] };
    const [first, second] = parse([input, input], list(Counted));
    expect(first).toEqual({ count: 1, tags: ['a'] });
    expect(first).not.toBe(second);
    expect(first?.tags).not.toBe(input.tags);
  });
});

describe('a union member stops at its first issue', () => {
  test('a recursive union validates in linear time with the discriminant sorted last', () => {
    const depth = 30;
    const budget = 4 * depth;
    let steps = 0;
    let reads = 0;
    // Key sorting puts the recursive `child` before the discriminant `kind`.
    // Each descent past the budget throws, so an exponential walk ends fast and fails.
    const member = (kind: string): Schema =>
      object(kind.toUpperCase(), {
        get child(): Schema {
          reads += 1;
          return coerce(nullable(Tree), (value) => {
            steps += 1;
            if (steps > budget) {
              throw new Error('over budget');
            }
            return value;
          });
        },
        kind: literal(kind),
      });
    const Tree: Schema = union('Tree', [member('a'), member('b')]);
    expect(
      validate(
        chain(depth, (child) => ({ child, kind: 'b' })),
        Tree,
      ).issues,
    ).toBeUndefined();
    expect(steps).toBeLessThanOrEqual(budget);
    steps = 0;
    expect(validate({ child: { child: null, kind: 'x' }, kind: 'b' }, Tree).issues).toEqual([
      { message: 'Expected "a" | "b", received "x"', path: ['child', 'kind'] },
    ]);
    // Getters are read once per object schema, on first use — never per validation.
    expect(reads).toBe(2);
  });
  test('an accepted member keeps shape key order in its output', () => {
    const Node = union([
      object({
        child: nullable(object({ id: coerce(int(), Number) })),
        kind: literal('n'),
      }),
    ]);
    const input: unknown = JSON.parse('{"kind":"n","child":{"id":"1"}}');
    expect(Object.keys(parse(input, Node))).toEqual(['child', 'kind']);
  });
  test('outside a union every issue is reported, fields before unknown keys', () => {
    const Pair = object({ first: int(), second: int() });
    expect(validate({ first: 'x', second: 'y', third: 0 }, Pair).issues).toEqual([
      { message: 'Expected Int, received "x"', path: ['first'] },
      { message: 'Expected Int, received "y"', path: ['second'] },
      { message: 'Unknown field on object', path: ['third'] },
    ]);
    expect(validate([1, 'a', 'b'], list(int())).issues).toEqual([
      { message: 'Expected Int, received "a"', path: [1] },
      { message: 'Expected Int, received "b"', path: [2] },
    ]);
    expect(
      validate(
        { inner: { extra: 0, item: 'x' } },
        object({
          inner: union('Item', [object({ item: int() })]),
        }),
      ).issues,
    ).toEqual([{ message: 'Expected Item, received object', path: ['inner'] }]);
  });
});

describe('validate never throws', () => {
  test('r#5 r#15 a thrown Error whose message getter throws', () => {
    const hostile = new Error('x');
    Object.defineProperty(hostile, 'message', {
      get() {
        throw new Error('boom');
      },
    });
    const value = {
      get name(): string {
        throw hostile;
      },
    };
    expect(validate(value, object({ name: string() }))).toEqual({
      issues: [{ message: 'Threw: Error', path: ['name'] }],
    });
    expect(is(value, object({ name: string() }))).toBe(false);
  });
  test('r#5 r#15 a thrown revoked Proxy', () => {
    const { proxy, revoke } = Proxy.revocable(new Error('x'), {});
    revoke();
    const value = {
      get name(): string {
        throw proxy;
      },
    };
    expect(validate(value, object({ name: string() }))).toEqual({
      issues: [{ message: 'Threw: value', path: ['name'] }],
    });
  });
});

describe('sdl validity', () => {
  const Alpha = object('A', { name: string() });
  test('#13 #18 #34 names collide loudly, built-ins cannot be shadowed', () => {
    expect(() => sdl([object('X', { name: string() }), object('X', { note: string() })])).toThrow(
      'two different types are named X',
    );
    expect(() => sdl([enums('X', ['A']), object('X', { name: string() })])).toThrow(
      'two different types are named X',
    );
    expect(() => sdl([enums('Int', ['A'])])).toThrow('shadows a built-in');
    expect(() =>
      sdl([scalar('String', (value): value is string => typeof value === 'string')]),
    ).toThrow('shadows a built-in');
  });
  test('#13 refine and coerce keep the def, so they are the same type', () => {
    expect(refine(Alpha, 'x', () => true).def).toBe(Alpha.def);
    expect(coerce(Alpha, (raw) => raw).def).toBe(Alpha.def);
    expect(sdl([Alpha, refine(Alpha, 'x', () => true), coerce(Alpha, (raw) => raw)])).toBe(
      'type A {\n  name: String!\n}',
    );
  });
  test('#14 input nullability must be optional(nullable(x))', () => {
    expect(() => sdl([object('I', { name: nullable(string()) })], { input: true })).toThrow(
      'optional(nullable(x))',
    );
    expect(() => sdl([object('I', { name: optional(string()) })], { input: true })).toThrow(
      'optional(nullable(x))',
    );
    expect(
      sdl([object('I', { name: optional(nullable(string())) })], {
        input: true,
      }),
    ).toBe('input I {\n  name: String\n}');
  });
  test('#15 #31 #32 #25 #33 union members are named objects, once each', () => {
    const Beta = object('B', { note: string() });
    expect(sdl([union('U', [Alpha, Beta, Alpha, refine(Beta, 'x', () => true)])])).toContain(
      'union U = A | B',
    );
    expect(() => sdl([union('U', [Alpha, string()])])).toThrow('must be named objects');
    expect(() => sdl([union('U', [nullable(Alpha)])])).toThrow('must be named objects');
    expect(() => sdl([union('U', [])])).toThrow('has no members');
  });
  test('#16 names follow the GraphQL grammar', () => {
    expect(() => sdl([object('Bad Name', { name: string() })])).toThrow('not a valid');
    expect(() => sdl([object('__T', { name: string() })])).toThrow('not a valid');
    expect(() => sdl([object('T', { 'a-b': string() })])).toThrow('not a valid');
    expect(() => sdl([enums('E', ['true'])])).toThrow('reserved');
  });
  test('#17 empty objects and enums are rejected', () => {
    expect(() => sdl([object('E', {})])).toThrow('has no fields');
    expect(() => sdl([enums('E', [])])).toThrow('has no values');
    expect(() => sdl([enums('Dup', ['A', 'B', 'A'])])).toThrow(
      'sdl: enum Dup has duplicate value A',
    );
  });
  test('#24 an input object cannot require itself', () => {
    const Chain: Schema = object('Node', {
      get next() {
        return Chain;
      },
    });
    expect(() => sdl([Chain], { input: true })).toThrow(
      'sdl: input Node references itself through non-null fields',
    );
    expect(sdl([Chain])).toBe('type Node {\n  next: Node!\n}');
    const Tree: Schema = object('Tree', {
      get kids() {
        return list(Tree);
      },
      get up() {
        return optional(nullable(Tree));
      },
    });
    expect(sdl([Tree], { input: true })).toBe('input Tree {\n  kids: [Tree!]!\n  up: Tree\n}');
  });
  test('#24 a type reached twice (a diamond) is not a cycle', () => {
    const Point = object('Point', { count: int() });
    expect(sdl([object('Pair', { left: Point, right: Point })], { input: true })).toBe(
      'input Pair {\n  left: Point!\n  right: Point!\n}\n\ninput Point {\n  count: Int!\n}',
    );
  });
  test('#24 a cycle may span types and pass through coerce', () => {
    const Ping: Schema = object('Ping', {
      get pong() {
        return coerce(Pong, (raw) => raw);
      },
    });
    const Pong: Schema = object('Pong', {
      get ping() {
        return Ping;
      },
    });
    expect(() => sdl([Ping], { input: true })).toThrow(
      'sdl: input Ping references itself through non-null fields',
    );
  });
});

describe('sdl output and built-ins', () => {
  test('r#12 output optional must be nullable — responses send null', () => {
    expect(() => sdl([object('O', { bio: optional(string()) })])).toThrow(
      'sdl: output optional(x) must be nullable(x) — GraphQL responses send null, never omit',
    );
    expect(sdl([object('O', { bio: optional(nullable(string())) })])).toBe(
      'type O {\n  bio: String\n}',
    );
    expect(sdl([object('O', { bio: nullable(string()) })])).toBe('type O {\n  bio: String\n}');
  });
  test('S5 a root operation type name is only for an output object', () => {
    const root = 'is a root operation type name — only an output object can use it';
    expect(() => sdl([enums('Query', ['A'])])).toThrow(`sdl: Query ${root}`);
    expect(() => sdl([scalar('Mutation', (value): value is 1 => value === 1)])).toThrow(
      `sdl: Mutation ${root}`,
    );
    expect(() => sdl([union('Subscription', [object('A', { name: string() })])])).toThrow(
      `sdl: Subscription ${root}`,
    );
    expect(() => sdl([object('Query', { name: string() })], { input: true })).toThrow(
      `sdl: Query ${root}`,
    );
    expect(sdl([object('Query', { name: string() })])).toBe('type Query {\n  name: String!\n}');
  });
  test('r#22 built-in scalar defs are frozen', () => {
    expect(Object.isFrozen(int().def)).toBe(true);
    expect(Object.isFrozen(string().def)).toBe(true);
  });
});

// The 2026-09-28 fast-path redesign: `is` runs only the fast check; `validate`
// runs the full check only after the fast one rejects.
/**
The full check alone, bypassing the fast one.
*/
const full = (value: unknown, against: Schema): boolean => {
  const issues: Issue[] = [];
  try {
    impl(against).run(value, { issues, path: [] });
  } catch {
    return false;
  }
  return issues.length === 0;
};

describe('the fast and full checks agree', () => {
  test('on a corpus of schemas and hostile values', () => {
    const Tree: Schema = union('Tree', [
      object('Leaf', { kind: literal('leaf'), value: int() }),
      object('Branch', {
        get children() {
          return list(Tree);
        },
        kind: literal('branch'),
      }),
    ]);
    const Linked: Schema = object({
      get next() {
        return nullable(Linked);
      },
    });
    const schemas: Schema[] = [
      int(),
      string(),
      literal(Number.NaN),
      enums(['A', 'B']),
      unknown(),
      nullable(int()),
      optional(string()),
      list(int()),
      list(list(unknown())),
      object({}),
      object({ name: string(), note: optional(string()) }),
      object({ constructor: optional(string()), toString: optional(int()) }),
      object({ count: coerce(int(), Number), name: string() }),
      object({ name: coerce(string(), (raw) => raw ?? 'dflt') }),
      refine(int(), 'positive', (count) => count > 0),
      refine(object({ max: int(), min: int() }), 'ordered', (range) => range.min <= range.max),
      union([int(), string()]),
      union([object({ radius: int() }), object({ side: int() })]),
      Tree,
      Linked,
    ];
    const cyclic: { next?: unknown } = {};
    cyclic.next = cyclic;
    const loop: unknown[] = [];
    loop.push(loop);
    const hidden = { extra: 1 };
    Object.defineProperty(hidden, 'name', { value: 'x' });
    const values: unknown[] = [
      undefined,
      null,
      0,
      -0,
      1,
      -1,
      1.5,
      Number.NaN,
      '',
      '1',
      'A',
      'x',
      [],
      [1, 2],
      [1, , 3],
      [[1], []],
      loop,
      {},
      Object.create(null),
      Object.create({ name: 'x' }),
      { name: 'x' },
      { name: 1 },
      { name: 'x', note: 'y' },
      { extra: 1, name: 'x' },
      hidden,
      { count: '3', name: 'x' },
      { max: 2, min: 1 },
      { max: 1, min: 2 },
      { radius: 1 },
      { radius: 1, side: 1 },
      { constructor: 'x' },
      { toString: 1 },
      JSON.parse('{"__proto__":{"name":"x"},"name":"x"}'),
      { kind: 'leaf', value: 1 },
      {
        children: [
          { kind: 'leaf', value: 1 },
          { children: [], kind: 'branch' },
        ],
        kind: 'branch',
      },
      { children: [{ kind: 'leaf', value: 'x' }], kind: 'branch' },
      { next: null },
      { next: { next: null } },
      cyclic,
      new Date(),
    ];
    for (const against of schemas) {
      for (const value of values) {
        const accepted = is(value, against);
        expect([against.def.kind, value, full(value, against)]).toEqual([
          against.def.kind,
          value,
          accepted,
        ]);
        const messages = validate(value, against).issues?.map((found) => found.message);
        expect(messages?.some((text) => text.startsWith('Internal'))).not.toBe(true);
      }
    }
  });
  test('a coerce reached through a cycle of schemas is applied', () => {
    const Outer: Schema = object({
      count: coerce(int(), Number),
      get inner() {
        return Inner;
      },
    });
    const Inner: Schema = object({
      get outer() {
        return nullable(Outer);
      },
    });
    expect(parse({ count: '1', inner: { outer: null } }, Outer)).toEqual({
      count: 1,
      inner: { outer: null },
    });
    expect(parse({ outer: { count: '2', inner: { outer: null } } }, Inner)).toEqual({
      outer: { count: 2, inner: { outer: null } },
    });
  });
  test('a non-enumerable own field cannot mask an unknown key', () => {
    const Named = object({ name: string() });
    const masked = { extra: 1 };
    Object.defineProperty(masked, 'name', { value: 'x' });
    expect(paths(validate(masked, Named))).toEqual([['extra']]);
    const hidden = {};
    Object.defineProperty(hidden, 'name', { value: 'x' });
    expect(is(hidden, Named)).toBe(true);
  });
  test('a value that answers differently per read fails closed', () => {
    let reads = 0;
    const fickle = {
      get count(): unknown {
        reads += 1;
        return reads === 1 ? 'x' : 1;
      },
    };
    expect(validate(fickle, object({ count: int() }))).toEqual({
      issues: [{ message: 'Internal: fast and full checks disagree', path: [] }],
    });
  });
  test('a validation nested in a callback may walk the value its caller walks', () => {
    const Named = object({ name: string() });
    const value = { name: 'x' };
    const Outer = object({
      name: refine(string(), 'nested', () => is(value, Named)),
    });
    expect(is(value, Outer)).toBe(true);
    expect(validate(value, Outer).issues).toBeUndefined();
  });
});

// Findings of the 2026-09-28 trust review; the id is its ledger entry.
describe('schemas are sealed; schemas from elsewhere are adapted', () => {
  test('V1 a schema from another copy of verax is trusted only through ~standard', async () => {
    const other = await copy();
    expect(other.string).not.toBe(string);
    const Person = object({
      age: other.refine(other.int(), 'adult', (years) => years >= 18),
      name: other.string(),
    });
    expect(is({ age: 3, name: 42 }, Person)).toBe(false);
    expect(validate({ age: 3, name: 42 }, Person).issues).toEqual([
      { message: 'adult', path: ['age'] },
      { message: 'Expected String, received 42', path: ['name'] },
    ]);
    expect(is(['x'], list(other.int()))).toBe(false);
    expect(() => parse('zzz', union([other.literal('a')]))).toThrow(
      'Expected union member, received "zzz"',
    );
    expect(parse({ age: 20, name: 'x' }, Person)).toEqual({
      age: 20,
      name: 'x',
    });
    // And the other way round: a foreign issue path is prefixed with ours.
    expect(
      other.validate({ inner: { age: 20, name: 1 } }, other.object({ inner: Person })).issues,
    ).toEqual([{ message: 'Expected String, received 1', path: ['inner', 'name'] }]);
  });
  test('A2 V4 a schema exposes only def and ~standard: its checks cannot run out of frame', () => {
    const Named = object({ name: string() });
    for (const each of [
      int(),
      Named,
      list(Named),
      union([Named]),
      refine(Named, 'r', () => true),
    ]) {
      expect(Object.keys(each)).toEqual(['def', '~standard']);
    }
    // A spread copy shares the schema's `~standard`, so it is the schema.
    const spread: Schema = { ...Named };
    expect(validate({ inner: { name: 1 } }, object({ inner: spread })).issues).toEqual([
      { message: 'Expected String, received 1', path: ['inner', 'name'] },
    ]);
    expect(stackDepth()).toBe(0);
  });
  test('an asynchronous Standard Schema is an issue, never a hang or a throw', () => {
    const Async: Schema = {
      '~standard': {
        validate: async (value: unknown) => {
          await Promise.resolve();
          return { value };
        },
        vendor: 'elsewhere',
        version: 1,
      },
      def: { kind: 'unknown' },
    };
    expect(validate([], list(Async)).issues).toBeUndefined();
    expect(validate([1], list(Async)).issues).toEqual([
      { message: 'Asynchronous validation is not supported', path: [0] },
    ]);
  });
});

describe('type surface', () => {
  test('A1 a bad field is reported at the field, not the whole argument list', () => {
    const Named = object('Named', {
      // @ts-expect-error -- the error lands on the field
      count: 1,
    });
    const Anonymous = object({
      // @ts-expect-error -- the error lands on the field
      count: 1,
    });
    expect([Named.def.kind, Anonymous.def.kind]).toEqual(['object', 'object']);
  });
  test('A5 a key is optional exactly when its schema admits undefined', () => {
    const Loose = object({
      any: unknown(),
      gone: literal(undefined),
      maybe: nullable(optional(int())),
      named: string(),
    });
    true satisfies Equal<
      Input<typeof Loose>,
      {
        any?: unknown;
        gone?: undefined;
        maybe?: number | null | undefined;
        named: string;
      }
    >;
    true satisfies Equal<Infer<typeof Loose>, Input<typeof Loose>>;
    expect(is({ named: 'x' }, Loose)).toBe(true);
  });
  test('A6 the published manifest resolves outside the workspace', async () => {
    const manifest: unknown = await Bun.file(new URL('../package.json', import.meta.url)).json();
    expect(JSON.stringify(manifest)).not.toContain('workspace:');
  });
});

describe('outputs are snapshots of what was read', () => {
  test('S1 a getter that mutates the input cannot smuggle data into the output', () => {
    const items: unknown[] = [];
    Object.defineProperty(items, 0, {
      configurable: true,
      enumerable: true,
      get() {
        if (items.length === 1) {
          items.push('not an int');
        }
        return 1;
      },
    });
    items.length = 1;
    expect(parse(items, list(int()))).toEqual([1]);
    const target: Record<string, unknown> = {};
    Object.defineProperty(target, 'count', {
      configurable: true,
      enumerable: true,
      get() {
        target['evil'] = 1;
        return 1;
      },
    });
    // Leaf fields are read before unknown keys are sought: the key it adds is found, never output.
    expect(validate(target, object({ count: int() })).issues).toEqual([
      { message: 'Unknown field on object', path: ['evil'] },
    ]);
  });
  test('S2 a throwing shape getter in a branch the value never reaches does not reject it', () => {
    const Broken = object({
      get never(): Schema {
        throw new Error('broken getter');
      },
    });
    expect(
      validate({ count: 1 }, object({ count: int(), rest: optional(Broken) })).issues,
    ).toBeUndefined();
    expect(validate(5, union([int(), list(Broken)])).issues).toBeUndefined();
  });
  test('H2 the output is plain data: read once, from own keys, with no accessor, prototype or subclass of the input', () => {
    const User = object('User', {
      name: string(),
      role: optional(enums(['MEMBER'])),
    });
    let reads = 0;
    const flipping = parse(
      {
        name: 'x',
        get role(): string {
          reads += 1;
          return reads === 1 ? 'MEMBER' : 'ADMIN';
        },
      },
      User,
    );
    expect([flipping.role, flipping.role]).toEqual(['MEMBER', 'MEMBER']);
    const inheriting = Object.create(
      Object.assign(Object.create(null) as object, { role: 'ADMIN' }),
      {
        name: { enumerable: true, value: 'x' },
      },
    ) as unknown;
    expect(is(inheriting, User)).toBe(false);
    expect(Object.getPrototypeOf(parse({ name: 'x' }, User))).toBe(Object.prototype);
    const hiding = { name: 'x' };
    Object.defineProperty(hiding, 'isAdmin', { value: true });
    expect(Object.getOwnPropertyNames(parse(hiding, User))).toEqual(['name']);
    let flip = false;
    const proxied = parse(
      new Proxy(
        { name: 'x' },
        {
          get: (target, key) =>
            flip && key === 'name' ? 12_345 : (Reflect.get(target, key) as unknown),
        },
      ),
      User,
    );
    flip = true;
    expect(proxied.name).toBe('x');
    const names = ['a'];
    const listed = parse(names, list(string()));
    names.push('b');
    expect(listed).toEqual(['a']);
    const evil = Object.setPrototypeOf(
      ['a'],
      Object.create(Array.prototype as object, {
        map: {
          value: () => {
            throw new Error('attacker code ran');
          },
        },
      }) as object,
    ) as unknown;
    const subclassed = parse(evil, list(string()));
    expect(Object.getPrototypeOf(subclassed)).toBe(Array.prototype);
    expect(subclassed.map((name) => name)).toEqual(['a']);
  });
  test('S3 the shape is read once, on first use: def.shape is a frozen null-prototype copy', () => {
    const shape: Record<string, Schema> = { count: int() };
    const Counted = object(shape);
    expect(is({ count: 1 }, Counted)).toBe(true);
    shape['extra'] = int();
    expect(is({ count: 1 }, Counted)).toBe(true);
    expect(Counted.def.kind === 'object' && Object.isFrozen(Counted.def.shape)).toBe(true);
    expect(Counted.def.kind === 'object' && Object.getPrototypeOf(Counted.def.shape)).toBe(null);
  });
  test('V3 a shape getter that throws once reports its throw, not a disagreement', () => {
    let reads = 0;
    const Late = object({
      get name(): Schema {
        reads += 1;
        if (reads === 1) {
          throw new Error('not ready');
        }
        return string();
      },
    });
    expect(validate({ name: 'x' }, Late).issues).toEqual([
      { message: 'Threw: not ready', path: [] },
    ]);
    expect(validate({ name: 'x' }, Late).issues).toBeUndefined();
  });
});

describe('hostile values and limits', () => {
  test('H1 a thrown error whose message is not a string is described', () => {
    const symbolic = new Error('x');
    Object.defineProperty(symbolic, 'message', { value: Symbol('s') });
    const opaque = new Error('x');
    Object.defineProperty(opaque, 'message', {
      value: {
        toString(): never {
          throw new Error('toString');
        },
      },
    });
    const Named = object({ name: string() });
    for (const [error, message] of [
      [symbolic, 'Threw: Symbol(s)'],
      [opaque, 'Threw: object'],
    ] as const) {
      const value = {
        get name(): string {
          throw error;
        },
      };
      expect(validate(value, Named).issues).toEqual([{ message, path: ['name'] }]);
      expect(Named['~standard'].validate(value)).toEqual({
        issues: [{ message, path: ['name'] }],
      });
    }
  });
  test('H3 M1 a recursive union without a discriminant is bounded: Too complex, never exponential', () => {
    const levels = 24;
    let calls = 0;
    const counted = (of: Schema): Schema =>
      coerce(of, (value) => {
        calls += 1;
        return value;
      });
    const Chain: Schema = union([
      object({
        get next(): Schema {
          return counted(nullable(Chain));
        },
      }),
      object({
        get next(): Schema {
          return counted(nullable(Chain));
        },
        note: optional(string()),
      }),
    ]);
    // Only the innermost link is wrong: every member fails only after descending, 2^24 ways.
    let bad: unknown = { next: null, note: 5 };
    for (let level = 0; level < levels; level += 1) {
      bad = { next: bad };
    }
    expect(validate(bad, Chain).issues).toEqual([{ message: 'Too complex', path: [] }]);
    expect(calls).toBeLessThanOrEqual(2_000_000);
    calls = 0;
    expect(is(bad, Chain)).toBe(false);
    expect(calls).toBeLessThanOrEqual(1_000_000);
  });
  test('D3 a union never swallows a RangeError: stack exhaustion fails the check, not the member', () => {
    const Exhausts = refine(int(), 'never', () => {
      throw new RangeError('Maximum call stack size exceeded');
    });
    expect(is(1, union([Exhausts, int()]))).toBe(false);
    expect(validate(1, union([Exhausts, int()])).issues).toEqual([
      { message: 'Threw: Maximum call stack size exceeded', path: [] },
    ]);
  });
  test('V2 depth is a limit, not the engine stack: 512 containers pass, the 513th is refused', () => {
    const Linked: Schema = object({
      get next(): Schema {
        return nullable(Linked);
      },
    });
    const Either: Schema = union([
      object({
        get next(): Schema {
          return nullable(Either);
        },
      }),
      object({
        get next(): Schema {
          return nullable(Either);
        },
        note: optional(string()),
      }),
    ]);
    for (const frames of [0, 2000]) {
      for (const [against, make] of [
        [Linked, (levels: number) => chain(levels, (next) => ({ next }))],
        [Either, (levels: number) => chain(levels, (next) => ({ next }))],
      ] as const) {
        expect(beneath(frames, () => is(make(512), against))).toBe(true);
        expect(beneath(frames, () => is(make(513), against))).toBe(false);
        const [found] =
          (beneath(frames, () => validate(make(513), against).issues) as Issue[] | undefined) ?? [];
        // Past the limit the undiscriminated union retries every path: too complex, not too deep.
        expect(found?.message).toBe(against === Linked ? 'Too deep' : 'Too complex');
      }
    }
    const [deepest] =
      validate(
        chain(513, (next) => ({ next })),
        Linked,
      ).issues ?? [];
    expect(deepest?.path).toHaveLength(512);
    expect(stackDepth()).toBe(0);
  });
  test('a proxy whose length lies is not a list: only a valid array length sizes an output', () => {
    for (const length of [-1, 1.5, 'abc', 2 ** 32, Number.NaN]) {
      const lying = new Proxy([], {
        get: (target, key) => (key === 'length' ? length : (Reflect.get(target, key) as unknown)),
      });
      expect(is(lying, list(int()))).toBe(false);
      expect(validate(lying, list(list(int()))).issues).toEqual([
        { message: 'Invalid list length', path: [] },
      ]);
    }
  });
  test('H5 issues stop at 100, and so does the walk', () => {
    expect(
      validate(
        Array.from({ length: 1000 }, () => 'x'),
        list(int()),
      ).issues,
    ).toHaveLength(100);
    const sparse: unknown[] = [];
    sparse.length = 5_000_000;
    const started = performance.now();
    const { issues } = validate(sparse, list(int()));
    expect(issues).toHaveLength(100);
    expect(issues?.at(-1)?.path).toEqual([99]);
    expect(performance.now() - started).toBeLessThan(1000);
    // Past the work budget a list is refused before a single item is read.
    sparse.length = 2 ** 32 - 1;
    expect(validate(sparse, list(int())).issues).toEqual([{ message: 'Too complex', path: [] }]);
    const wide = Object.fromEntries(Array.from({ length: 1000 }, (_value, at) => [`k${at}`, 1]));
    expect(validate(wide, object({})).issues).toHaveLength(100);
  });
});

describe('a union verdict depends on its path', () => {
  test('D4 a verdict does not carry across paths of equal depth', () => {
    // `armed` is walked first: a member fails after running a nested union.
    const Armed = union([
      object({ first: union([unknown()]), second: object({ count: int() }) }),
      unknown(),
    ]);
    const Tried = union([object({ via: object({ back: unknown() }) })]);
    const target: { via?: unknown } = {};
    const cycle = { back: target };
    target.via = cycle;
    const Root = object({
      armed: Armed,
      left: object({ at: Tried }),
      right: object({ back: Tried }),
    });
    // `left` reaches `target` beneath a fresh object; `right` beneath `cycle`,
    // which `target` leads back to — at the same depth; a cycle is not special.
    const value = {
      armed: { first: 1, second: { count: 'x' } },
      left: { at: target },
      right: cycle,
    };
    expect(is(value.right, object({ back: Tried }))).toBe(true);
    expect(is(value, Root)).toBe(true);
    expect(validate(value, Root).issues).toBeUndefined();
  });
});

// The 2026-10-23 union-errors pass: a failed union says why, not only that it failed.
describe('a failed union reports why', () => {
  const Email = scalar('Email', (value): value is string => String(value).includes('@'));
  const Phone = scalar('Phone', (value): value is string => String(value).startsWith('+'));
  const User = union('User', [
    object('EmailUser', { email: Email, name: string(), phone: optional(Phone) }),
    object('PhoneUser', { email: optional(Email), name: string(), phone: Phone }),
  ]);
  const Message = union('Message', [
    object('Ping', { __typename: literal('Ping'), at: int() }),
    object('Track', { __typename: literal('Track'), event: string(), props: object({ n: int() }) }),
  ]);
  test('U1 tried in turn: the closest member’s issues — fewest, first on a tie, never one failing at the value itself', () => {
    expect(validate({ name: 'A', phone: '555' }, User).issues).toEqual([
      { message: 'Expected Phone, received "555"', path: ['phone'] },
    ]);
    expect(validate([{ name: 1 }], list(User)).issues).toEqual([
      { message: 'Expected Email, received undefined', path: [0, 'email'] },
      { message: 'Expected String, received 1', path: [0, 'name'] },
    ]);
    expect(validate({ a: 'x' }, union([string(), object({ a: int() })])).issues).toEqual([
      { message: 'Expected Int, received "x"', path: ['a'] },
    ]);
    // A member that does not know a key the value holds is not it.
    const Response = union('Response', [
      object('Ok', { age: int(), id: int() }),
      object('Err', { error: string() }),
    ]);
    expect(validate({ id: '1' }, Response).issues).toEqual([
      { message: 'Expected Int, received undefined', path: ['age'] },
      { message: 'Expected Int, received "1"', path: ['id'] },
    ]);
    // No member gets past the value, or knows its keys: the mismatch, as before.
    expect(validate(5, User).issues).toEqual([{ message: 'Expected User, received 5', path: [] }]);
    const Positive = union([
      refine(object({ a: int() }), 'a must be positive', ({ a }) => a > 0),
      object({ b: int() }),
    ]);
    expect(validate({ a: -1 }, Positive).issues).toEqual([
      { message: 'Expected union member, received object', path: [] },
    ]);
  });
  test('U2 tagged: the member the tag names, refined too, else the tags accepted; a coerce reads another tag', () => {
    const track = { __typename: 'Track', event: 1, props: { n: 'x' } };
    const issues = [
      { message: 'Expected String, received 1', path: ['event'] },
      { message: 'Expected Int, received "x"', path: ['props', 'n'] },
    ];
    expect(validate(track, Message).issues).toEqual(issues);
    const [Ping, Track] = Message.def.kind === 'union' ? (Message.def.of as Schema[]) : [];
    const Tried = union([
      refine(Ping as Schema, 'never', () => true),
      refine(Track as Schema, 'never', () => true),
    ]);
    expect(validate(track, Tried).issues).toEqual(issues);
    expect(validate({ __typename: 'Pong' }, Message).issues).toEqual([
      { message: 'Expected "Ping" | "Track", received "Pong"', path: ['__typename'] },
    ]);
    expect(validate({}, Tried).issues).toEqual([
      { message: 'Expected "Ping" | "Track", received undefined', path: ['__typename'] },
    ]);
    expect(validate([], Message).issues).toEqual([
      { message: 'Expected Message, received list', path: [] },
    ]);
    // A coerce may rewrite the tag it checks: tried in turn, the closest.
    expect(
      validate(
        { __typename: 'Pong' },
        union([Ping as Schema, coerce(Track as Schema, (value) => value)]),
      ).issues,
    ).toEqual([
      { message: 'Expected "Ping", received "Pong"', path: ['__typename'] },
      { message: 'Expected Int, received undefined', path: ['at'] },
    ]);
    // The member named is the explanation, even where it fails at the value itself.
    const Refined = union([
      refine(object({ k: literal('a') }), 'not this a', () => false),
      object({ k: literal('b') }),
    ]);
    expect(validate({ k: 'a' }, Refined).issues).toEqual([{ message: 'not this a', path: [] }]);
  });
  test('U3 explaining never throws: a member’s throw is its issue, at its path; a limit is the union’s', () => {
    const boom = {
      get name(): string {
        throw new Error('getter');
      },
    };
    expect(validate(boom, union([int(), object({ name: string() })])).issues).toEqual([
      { message: 'Threw: getter', path: ['name'] },
    ]);
    // A shape that throws while the union explains itself is the explanation.
    let reads = 0;
    const Late = union([
      object({ k: literal('a') }),
      object({
        get k(): Schema {
          reads += 1;
          if (reads <= 5) {
            throw new Error('not ready');
          }
          return literal('b');
        },
      }),
    ]);
    expect(validate({ k: 'c' }, Late).issues).toEqual([{ message: 'Threw: not ready', path: [] }]);
    expect(validate({ k: 'c' }, Late).issues).toEqual([
      { message: 'Expected "a" | "b", received "c"', path: ['k'] },
    ]);
    // A validation nested in a member being tried judges as anywhere: the mismatch, never a disagreement.
    const seen = new Set<string>();
    const Inner = union([object({ a: int() }), object({ b: string() })]);
    const Spy = refine(unknown(), 'spy', (value) => {
      seen.add(JSON.stringify(validate(value, Inner).issues));
      return false;
    });
    validate(
      { p: { a: 'no' }, q: 'x' },
      union([object({ p: Spy, q: int() }), object({ r: int() })]),
    );
    expect([...seen]).toEqual(['[{"message":"Expected union member, received object","path":[]}]']);
    // A union taken to pass while its member is tried is unjudged: a refine above it never tests it.
    const tested: unknown[] = [];
    const Tested = refine(object({ u: Inner }), 'r', ({ u }) => {
      tested.push(u);
      return true;
    });
    validate({ u: { n: 'x' } }, union([Tested, object({ z: int() })]));
    expect(tested).toEqual([]);
    // Stack exhaustion met explaining is never a failed member: it fails the whole check.
    let calls = 0;
    const Edge = refine(int(), 'edge', () => {
      calls += 1;
      if (calls > 2) {
        throw new RangeError('Maximum call stack size exceeded');
      }
      return false;
    });
    expect(validate({ a: 1 }, union([object({ a: Edge })])).issues).toEqual([
      { message: 'Threw: Maximum call stack size exceeded', path: [] },
    ]);
    // Issues still stop at 100, inside the member explained.
    const Wide = union([int(), object({ items: list(int()) })]);
    expect(validate({ items: Array.from({ length: 300 }, () => 'x') }, Wide).issues).toHaveLength(
      100,
    );
  });
});

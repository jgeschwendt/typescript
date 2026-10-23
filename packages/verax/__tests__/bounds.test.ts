// Findings of the 2026-09-28 final unanchored review; the id is its ledger entry.
import { describe, expect, test } from 'bun:test';
import { type Equal, beneath, chain, copy, paths, steps, sweep, trap } from './_helpers.js';
import { depth as stackDepth } from '../src/core.js';
import {
  type Infer,
  type Input,
  type Issue,
  type Schema,
  type StandardSchemaV1,
  VeraxError,
  coerce,
  enums,
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

/**
A standard schema from elsewhere, as a hand-written adapter would make one.
*/
const elsewhere = (validator: (value: unknown) => unknown): Schema => ({
  '~standard': {
    validate: validator as StandardSchemaV1['~standard']['validate'],
    vendor: 'elsewhere',
    version: 1,
  },
  def: { kind: 'unknown' },
});

describe('work is bounded, whatever composes the schema', () => {
  test('B1 F1 a spread of a schema is that schema: recursion through one is linear, and a cycle stops at the depth limit', () => {
    const budget = steps(10_000);
    const Node: Schema = object('Node', {
      count: int(),
      get next(): Schema {
        return nullable(coerce({ ...Node }, budget.tick));
      },
    });
    const levels = 24;
    const bad = chain(levels, (next) => ({
      count: next === null ? 'x' : 1,
      next,
    }));
    expect(paths(validate(bad, Node))).toEqual([
      [...Array.from({ length: levels - 1 }, () => 'next'), 'count'],
    ]);
    expect(budget.calls).toBeLessThanOrEqual(4 * levels);
    const cyclic: Record<string, unknown> = { count: 1 };
    cyclic['next'] = cyclic;
    expect(is(cyclic, Node)).toBe(false);
    expect(validate(cyclic, Node).issues).toEqual([
      { message: 'Too deep', path: Array.from({ length: 512 }, () => 'next') },
    ]);
    expect(stackDepth()).toBe(0);
  });
  test('B2 M1 a recursive union retried through a callback that validates is bounded', () => {
    let budget = steps(0);
    const normalise = (value: unknown): unknown =>
      budget.tick(is(value, string()) ? JSON.parse(value) : value);
    const Reentrant: Schema = union([
      object({
        get next(): Schema {
          return nullable(Reentrant);
        },
        tags: list(literal(1)),
      }),
      coerce(
        object({
          get next(): Schema {
            return nullable(Reentrant);
          },
          tags: list(literal(2)),
        }),
        normalise,
      ),
    ]);
    budget = steps(10_000);
    expect(
      is(
        chain(8, (next) => ({ next, tags: [2] })),
        Reentrant,
      ),
    ).toBe(true);
    const value = chain(30, (next) => ({ next, tags: [2] }));
    budget = steps(1_000_000);
    expect(is(value, Reentrant)).toBe(false);
    budget = steps(1_000_000);
    expect(validate(value, Reentrant).issues).toEqual([{ message: 'Too complex', path: [] }]);
    expect(stackDepth()).toBe(0);
  });
  test('B2 F3 a coerce that copies inside a recursive union is budgeted: Too complex, never exponential', () => {
    let budget = steps(0);
    const duplicate = (value: unknown): unknown =>
      budget.tick(typeof value === 'object' && value !== null ? { ...value } : value);
    const Copied: Schema = union([
      coerce(
        object({
          get next(): Schema {
            return nullable(Copied);
          },
          tags: list(literal(1)),
        }),
        duplicate,
      ),
      object({
        get next(): Schema {
          return nullable(Copied);
        },
        tags: list(literal(2)),
      }),
    ]);
    // Within budget the verdict is exact; past it, a deterministic rejection.
    budget = steps(10_000);
    expect(
      is(
        chain(10, (next) => ({ next, tags: [2] })),
        Copied,
      ),
    ).toBe(true);
    const value = chain(40, (next) => ({ next, tags: [2] }));
    budget = steps(150_000);
    expect(is(value, Copied)).toBe(false);
    expect(budget.calls).toBeLessThanOrEqual(150_000);
    budget = steps(300_000);
    expect(validate(value, Copied).issues).toEqual([{ message: 'Too complex', path: [] }]);
    expect(budget.calls).toBeLessThanOrEqual(300_000);
    expect(stackDepth()).toBe(0);
  });
  test('M1 work is counted in fields and items, not containers: wide levels cannot stretch the budget', () => {
    const budget = steps(100_000);
    const wide = Object.fromEntries(Array.from({ length: 200 }, (_value, at) => [`f${at}`, int()]));
    const level = (tag: number): Schema =>
      object({
        ...wide,
        count: refine(int(), 'counted', (count) => budget.tick(count) >= 0),
        get next(): Schema {
          return nullable(Wide);
        },
        tags: list(literal(tag)),
      });
    const Wide: Schema = union([level(1), level(2)]);
    const fields = Object.fromEntries(Array.from({ length: 200 }, (_value, at) => [`f${at}`, at]));
    for (const tags of [[2], Array.from({ length: 5000 }, () => 2)]) {
      budget.calls = 0;
      expect(
        validate(
          chain(40, (next) => ({ ...fields, count: 1, next, tags })),
          Wide,
        ).issues,
      ).toEqual([{ message: 'Too complex', path: [] }]);
      // Counted by containers alone, a million levels would be retried.
      expect(budget.calls).toBeLessThanOrEqual(20_000);
    }
  });
  test('F3 recursion across two copies of verax is budgeted: a rejection, never exponential', async () => {
    const other = await copy();
    let budget = steps(0);
    const counted = (value: number): boolean => budget.tick(value) >= 0;
    const Ours: Schema = object({
      count: refine(int(), 'counted', counted),
      get next(): Schema {
        return nullable(Theirs);
      },
    });
    const Theirs: Schema = other.object({
      count: other.refine(other.int(), 'counted', counted),
      get next(): Schema {
        return other.nullable(Ours);
      },
    });
    const cyclic: Record<string, unknown> = { count: 1 };
    cyclic['next'] = cyclic;
    const bad = chain(60, (next) => ({
      count: next === null ? 'x' : 1,
      next,
    }));
    for (const value of [bad, cyclic]) {
      budget = steps(4_000_000);
      expect(validate(value, Ours).issues?.[0]?.message).toBe('Too complex');
      expect(budget.calls).toBeLessThanOrEqual(4_000_000);
      budget = steps(4_000_000);
      expect(is(value, Ours)).toBe(false);
      expect(budget.calls).toBeLessThanOrEqual(4_000_000);
    }
  });
  test('F2 depth continues into a validation nested in a callback', () => {
    const Inner = object({
      one: object({ two: object({ three: object({}) }) }),
    });
    const found: (readonly Issue[] | undefined)[] = [];
    const Probe = refine(unknown(), 'probe', () => {
      found.push(validate({ one: { two: { three: {} } } }, Inner).issues);
      return true;
    });
    const Linked: Schema = object({
      get next(): Schema {
        return nullable(Linked);
      },
      probe: optional(Probe),
    });
    for (const levels of [508, 509]) {
      const value = chain(levels, (next) => (next === null ? { next, probe: 1 } : { next }));
      expect(validate(value, Linked).issues).toBeUndefined();
    }
    expect(found).toEqual([undefined, [{ message: 'Too deep', path: ['one', 'two', 'three'] }]]);
  });
  test('F2 F3 recursion through a hand-written schema that calls verax is bounded by depth, not the engine stack', () => {
    let budget = steps(0);
    let Node: Schema = int();
    const Hand = elsewhere((value) => budget.tick(Node['~standard'].validate(value)));
    Node = object({ next: nullable(Hand) });
    for (const frames of [0, 2000]) {
      budget = steps(3_000_000);
      const [found] =
        (beneath(
          frames,
          () =>
            validate(
              chain(2000, (next) => ({ next })),
              Node,
            ).issues,
        ) as Issue[] | undefined) ?? [];
      expect(found?.message).toMatch(/^Too (?:complex|deep)$/u);
      expect(budget.calls).toBeLessThanOrEqual(3_000_000);
    }
    expect(
      validate(
        chain(512, (next) => ({ next })),
        Node,
      ).issues,
    ).toBe(undefined);
    expect(stackDepth()).toBe(0);
  });
});

describe('the budget never trips on valid data', () => {
  const Kinds = ['a', 'b', 'c'] as const;
  test('F3 a discriminated recursive union 512 deep', () => {
    const Tree: Schema = union(
      Kinds.map((kind) =>
        object({
          kind: literal(kind),
          label: string(),
          get next(): Schema {
            return nullable(Tree);
          },
        }),
      ),
    );
    for (const kind of Kinds) {
      const value = chain(512, (next) => ({ kind, label: 't', next }));
      expect(is(value, Tree)).toBe(true);
      expect(parse(value, Tree)).toEqual(value);
    }
  });
  test('F3 a million-item list, of scalars and of union members found last', () => {
    const million = 1_000_000;
    expect(
      validate(
        Array.from({ length: million }, (_value, count) => count),
        list(int()),
      ).issues,
    ).toBeUndefined();
    const Tagged = union(
      Kinds.map((kind) => object({ inner: object({ count: int() }), kind: literal(kind) })),
    );
    // Untagged: the first member fails a level down, inside its own field.
    const Untagged = union([
      object({ inner: object({ count: string() }) }),
      object({ inner: object({ count: int() }) }),
    ]);
    const items = Array.from({ length: million }, (_value, count) => ({
      inner: { count },
      kind: 'c',
    }));
    expect(validate(items, list(Tagged)).issues).toBeUndefined();
    expect(is(items, list(Tagged))).toBe(true);
    const untagged = items.map(({ inner }) => ({ inner }));
    expect(validate(untagged, list(Untagged)).issues).toBeUndefined();
  });
  test('M1 an untagged union of wide members failing last, over 300,000 items', () => {
    const leaves = Object.fromEntries(
      Array.from({ length: 12 }, (_value, at) => [`f${at}`, int()]),
    );
    // Each failure wastes more than the free allowance: only the ratio to useful work keeps it linear.
    const Wide = union([object({ ...leaves, last: string() }), object({ ...leaves, last: int() })]);
    const fields = Object.fromEntries(Array.from({ length: 12 }, (_value, at) => [`f${at}`, at]));
    const items = Array.from({ length: 300_000 }, () => ({
      ...fields,
      last: 1,
    }));
    expect(is(items, list(Wide))).toBe(true);
    expect(validate(items, list(Wide)).issues).toBeUndefined();
  });
  test('F3 a nested document of 100,000 fields, through unions', () => {
    const Leaves = Object.fromEntries(
      Array.from({ length: 9 }, (_value, field) => [`f${field}`, int()]),
    );
    const Row = union(
      Kinds.map((kind) => object({ ...Leaves, kind: literal(kind), sub: object(Leaves) })),
    );
    const Document = object({ rows: list(Row) });
    const fields = Object.fromEntries(
      Array.from({ length: 9 }, (_value, field) => [`f${field}`, field]),
    );
    // 5,000 rows of 20 fields: 9 + kind + sub, and sub's 9.
    const document = {
      rows: Array.from({ length: 5000 }, () => ({
        ...fields,
        kind: 'c',
        sub: { ...fields },
      })),
    };
    expect(validate(document, Document).issues).toBeUndefined();
    expect(is(document, Document)).toBe(true);
  });
});

describe('foreign results are read defensively', () => {
  test('B3 F5 any thenable result is asynchronous, whatever its realm; only a thenable is', () => {
    const { runInNewContext } = process.getBuiltinModule('node:vm');
    const Other = runInNewContext('Promise') as PromiseConstructor;
    for (const result of [
      () => Other.resolve({ issues: [{ message: 'rejected' }] }),
      () => ({
        then: (resolve: (value: unknown) => void, reject: () => void) => {
          reject();
          resolve({ value: 1 });
        },
      }),
    ]) {
      const Holder = object({ field: elsewhere(result) });
      expect(is({ field: 1 }, Holder)).toBe(false);
      expect(validate({ field: 1 }, Holder).issues).toEqual([
        {
          message: 'Asynchronous validation is not supported',
          path: ['field'],
        },
      ]);
    }
    const [broken] = validate({ field: 1 }, object({ field: elsewhere(() => null) })).issues ?? [];
    expect(broken?.message).toBe('Invalid Standard Schema result');
  });
  test('N3 F6 a foreign issue path is sanitised to property keys', () => {
    const symbol = Symbol.for('s');
    const Holder = object({
      field: elsewhere(() => ({
        issues: [
          {
            message: 'no',
            path: [
              {
                key: {
                  toString: (): string => {
                    throw new Error('toString');
                  },
                },
              },
              { key: 1 },
              'k',
              symbol,
              null,
              7n,
            ],
          },
        ],
      })),
    });
    expect(validate({ field: 1 }, Holder).issues).toEqual([
      {
        message: 'no',
        path: ['field', 'object', 1, 'k', symbol, 'null', '7n'],
      },
    ]);
    expect(() => parse({ field: 1 }, Holder)).toThrow(VeraxError);
    expect(() => parse({ field: 1 }, Holder)).toThrow('field.object.1.k.Symbol(s).null.7n: no');
  });
});

/**
A recursive union whose members differ only below the recursion: every member descends.
*/
const undiscriminated = (counted: (value: unknown) => unknown): Schema => {
  const Either: Schema = union('Either', [
    object('A', {
      get next(): Schema {
        return coerce(nullable(Either), counted);
      },
      tags: list(literal(1)),
    }),
    object('B', {
      get next(): Schema {
        return coerce(nullable(Either), counted);
      },
      tags: list(literal(2)),
    }),
  ]);
  return Either;
};

describe('an undiscriminated recursive union fails closed', () => {
  test('N1 the verdict does not depend on whether the value is shared', () => {
    const Either = undiscriminated((value) => value);
    const Pair = object({ left: Either, right: Either });
    const [shared, twin] = [0, 1].map(() => chain(600, (next) => ({ next, tags: [2] })));
    const found = validate({ left: shared, right: shared }, Pair).issues;
    expect(found).toEqual([{ message: 'Too complex', path: ['left'] }]);
    expect(validate({ left: shared, right: twin }, Pair).issues).toEqual(found);
  });
  test('M1 deep and undiscriminated: Too complex, in bounded steps', () => {
    const budget = steps(3_000_000);
    const Either = undiscriminated(budget.tick);
    expect(
      validate(
        chain(600, (next) => ({ next, tags: [2] })),
        Either,
      ).issues,
    ).toEqual([{ message: 'Too complex', path: [] }]);
    expect(budget.calls).toBeLessThanOrEqual(3_000_000);
    // Shallow enough to try every path within the budget, the verdict is exact.
    expect(
      is(
        chain(12, (next) => ({ next, tags: [2] })),
        undiscriminated((value) => value),
      ),
    ).toBe(true);
  });
});

// Findings of the 2026-09-28 final unanchored review #2; the id is its ledger entry.
describe('one budget bounds a whole call', () => {
  test('B1 G1 a validation at the stack edge leaves no state behind', () => {
    const Point = object({ x: int() });
    const Chain: Schema = union([
      object({
        get next(): Schema {
          return nullable(Chain);
        },
      }),
      object({
        get next(): Schema {
          return nullable(Chain);
        },
        note: optional(string()),
      }),
    ]);
    const deep = chain(25, (next) => (next === null ? { next, note: 5 } : { next }));
    sweep(() => {
      validate({ x: 1 }, Point);
      validate({ x: 'x' }, Point);
      validate([{ x: 1 }, { x: 'x' }], list(Point));
    });
    // A call left open stays open: its budget, spent here, would never be renewed.
    expect(validate(deep, Chain).issues?.[0]?.message).toBe('Too complex');
    expect(validate({ x: 1 }, Point)).toEqual({ value: { x: 1 } });
    expect(is({ x: 1 }, Point)).toBe(true);
    expect(stackDepth()).toBe(0);
  });
  test('B2 G2 shared children are walked per path, within one budget: Too complex, in bounded reads', () => {
    let budget = steps(0);
    const Node: Schema = object('Node', {
      get left(): Schema {
        return nullable(Node);
      },
      get right(): Schema {
        return nullable(Node);
      },
    });
    // 64 levels, each object both children of the next: 2^64 paths.
    const dag = chain(64, (next) => ({
      get left(): unknown {
        return budget.tick(next);
      },
      get right(): unknown {
        return budget.tick(next);
      },
    }));
    budget = steps(25_000_000);
    expect(is(dag, Node)).toBe(false);
    expect(budget.calls).toBeLessThanOrEqual(25_000_000);
    budget = steps(25_000_000);
    const { issues = [] } = validate(dag, Node);
    expect(issues.map(({ message }) => message)).toEqual(['Too complex']);
    expect(budget.calls).toBeLessThanOrEqual(25_000_000);
    expect(stackDepth()).toBe(0);
  });
  test('B2 G2 the budget is 10 million steps: a list of n items is n + 1', () => {
    const holes: unknown[] = [];
    holes.length = 9_999_999;
    expect(is(holes, list(optional(int())))).toBe(true);
    holes.length = 10_000_000;
    expect(validate(holes, list(optional(int()))).issues).toEqual([
      { message: 'Too complex', path: [] },
    ]);
  });
  test('B2 G2 large tree-shaped data stays within it: a million fields, a million items', () => {
    const Fields = Object.fromEntries(
      Array.from({ length: 10 }, (_value, at) => [`f${at}`, int()]),
    );
    const Document = object({
      sections: list(object({ rows: list(object(Fields)) })),
    });
    const row = Object.fromEntries(Array.from({ length: 10 }, (_value, at) => [`f${at}`, at]));
    // 1,000 sections of 100 rows of 10 fields.
    const document = {
      sections: Array.from({ length: 1000 }, () => ({
        rows: Array.from({ length: 100 }, () => ({ ...row })),
      })),
    };
    expect(is(document, Document)).toBe(true);
    expect(validate(document, Document).issues).toBeUndefined();
    const Item = object({ id: int(), name: string() });
    const items = Array.from({ length: 1_000_000 }, (_value, at) => ({
      id: at,
      name: 'n',
    }));
    expect(is(items, list(Item))).toBe(true);
    expect(validate(items, list(Item)).issues).toBeUndefined();
  });
  test('B2 G2 a refine that re-validates its subtree is bounded: Too complex, never exponential', () => {
    let budget = steps(0);
    const Linked: Schema = refine(
      object({
        get next(): Schema {
          return nullable(Linked);
        },
      }),
      'checked',
      (value) => budget.tick(is((value as { next: unknown }).next, nullable(Linked))),
    );
    budget = steps(10_000);
    expect(
      is(
        chain(8, (next) => ({ next })),
        Linked,
      ),
    ).toBe(true);
    budget = steps(12_000_000);
    expect(
      validate(
        chain(40, (next) => ({ next })),
        Linked,
      ).issues?.map(({ message }) => message),
    ).toEqual(['Too complex']);
    expect(budget.calls).toBeLessThanOrEqual(12_000_000);
  });
  test('G2 past the budget no verdict stands, even one a callback inverts', () => {
    const Either = undiscriminated((value) => value);
    const NotEither = refine(unknown(), 'an Either', (value) => !is(value, Either));
    const value = chain(40, (next) => ({ next, tags: [2] }));
    expect(is(value, NotEither)).toBe(false);
    expect(validate(value, NotEither).issues).toEqual([{ message: 'Too complex', path: [] }]);
  });
  test('G2 every key enumerated is work: a shared object with many keys cannot cost more than it counts', () => {
    const wide = Object.fromEntries(Array.from({ length: 10_000 }, (_value, at) => [`k${at}`, at]));
    let budget = steps(0);
    const counted = (value: unknown): boolean => budget.tick(value) !== null;
    // Own keys: each item fails the first member only after enumerating them all.
    const Owned = list(union([object({}), refine(unknown(), 'counted', counted)]));
    const owned = Array.from({ length: 1_000_000 }, () => wide);
    budget = steps(5000);
    expect(is(owned, Owned)).toBe(false);
    expect(budget.calls).toBeLessThanOrEqual(5000);
    budget = steps(5000);
    expect(validate(owned, Owned).issues?.map(({ message }) => message)).toEqual(['Too complex']);
    expect(budget.calls).toBeLessThanOrEqual(5000);
    budget = steps(5000);
    expect(is(owned.slice(0, 100), Owned)).toBe(true);
  });
});

/**
An instance whose prototype's constructor bears `name`.
*/
const named = (name: unknown): unknown => Object.create({ constructor: { name } });

describe('messages name what was received', () => {
  test('G4 a non-plain object is named by its constructor, if that is a short identifier', () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('trap');
        },
      },
    );
    expect(
      [new Date(), named('Point'), named('<b>'), named(7), Object.create(null), [], hostile].map(
        (value) => validate(value, int()).issues?.[0]?.message,
      ),
    ).toEqual([
      'Expected Int, received Date',
      'Expected Int, received Point',
      'Expected Int, received object',
      'Expected Int, received object',
      'Expected Int, received object',
      'Expected Int, received list',
      'Expected Int, received value',
    ]);
    expect(validate(new Date(), object({})).issues).toEqual([
      { message: 'Expected object, received Date', path: [] },
    ]);
  });
  test('G4 a foreign result whose issues are not an array is invalid', () => {
    for (const issues of [5, 'no', { 0: { message: 'no' }, length: 1 }]) {
      const Holder = object({ field: elsewhere(() => ({ issues })) });
      expect(is({ field: 1 }, Holder)).toBe(false);
      expect(validate({ field: 1 }, Holder).issues).toEqual([
        { message: 'Invalid Standard Schema result', path: ['field'] },
      ]);
    }
  });
});

/**
The fastest of five timings of `thunk`, in ms.
*/
const fastest = (thunk: () => unknown): number => {
  let best = Infinity;
  for (let run = 0; run < 5; run += 1) {
    const started = performance.now();
    thunk();
    best = Math.min(best, performance.now() - started);
  }
  return best;
};

describe('plain data is bounded; exotic data costs its structure', () => {
  test('B2 H1 a list that fails forfeits its unread items: a sparse list retried under a union is Too complex, never an allocation per retry', () => {
    const sparse: unknown[] = [];
    sparse.length = 9_000_000;
    const Member = union([object({ x: list(object({ y: int() })) }), object({ x: unknown() })]);
    // One retry is within the budget; the second would allocate past it.
    expect(is([{ x: sparse }], list(Member))).toBe(true);
    const items = Array.from({ length: 400 }, () => ({ x: sparse }));
    expect(is(items, list(Member))).toBe(false);
    expect(validate(items, list(Member)).issues?.map(({ message }) => message)).toEqual([
      'Too complex',
    ]);
  });
  test('B1 H2 a plain object has Object.prototype or null as its prototype: keys hidden beneath another are never walked', () => {
    const hidden = Object.create(null) as object;
    for (let at = 0; at < 100_000; at += 1) {
      Object.defineProperty(hidden, `k${at}`, { value: at });
    }
    const heir: unknown = Object.create(hidden);
    const Items = list(object({ a: optional(int()) }));
    const items = Array.from({ length: 400 }, () => heir);
    expect(is(items, Items)).toBe(false);
    expect(validate(items, Items).issues?.[0]).toEqual({
      message: 'Expected object, received object',
      path: [0],
    });
  });
  test('B3 H3 a Standard Schema from elsewhere nests in every factory, typed by its own types', () => {
    const Digits: StandardSchemaV1<string, number> = {
      '~standard': {
        validate: (value) =>
          typeof value === 'string' && /^\d+$/u.test(value)
            ? { value: Number(value) }
            : { issues: [{ message: 'digits' }] },
        vendor: 'elsewhere',
        version: 1,
      },
    };
    const Holder = object({
      count: Digits,
      counts: list(Digits),
      either: union([Digits, int()]),
      maybe: nullable(Digits),
      other: optional(Digits),
    });
    true satisfies Equal<
      Infer<typeof Holder>,
      {
        count: number;
        counts: number[];
        either: number;
        maybe: number | null;
        other?: number | undefined;
      }
    >;
    true satisfies Equal<
      Input<typeof Holder>,
      {
        count: string;
        counts: string[];
        either: number | string;
        maybe: string | null;
        other?: string | undefined;
      }
    >;
    expect(parse({ count: '1', counts: ['2'], either: '3', maybe: null }, Holder)).toEqual({
      count: 1,
      counts: [2],
      either: 3,
      maybe: null,
    });
    expect(validate({ count: 'x', counts: [], either: 1, maybe: null }, Holder).issues).toEqual([
      { message: 'digits', path: ['count'] },
    ]);
  });
  test('H4 a foreign result that is neither issues nor a value is invalid, never a success', () => {
    for (const result of [5, 'ok', true, null, undefined, {}, { issues: undefined }]) {
      const Holder = object({ field: elsewhere(() => result) });
      expect(is({ field: 1 }, Holder)).toBe(false);
      expect(validate({ field: 1 }, Holder).issues).toEqual([
        { message: 'Invalid Standard Schema result', path: ['field'] },
      ]);
    }
    expect(
      validate({ field: 1 }, object({ field: elsewhere(() => ({ issues: undefined, value: 2 })) })),
    ).toEqual({ value: { field: 2 } });
    // No issues is still a rejection; a spec whose `~standard` throws is an adapter that throws.
    expect(
      validate(
        1,
        elsewhere(() => ({ issues: [] })),
      ).issues,
    ).toEqual([{ message: 'Rejected', path: [] }]);
    const hostile = new Proxy({}, trap('~standard')) as Schema;
    expect(validate(1, hostile).issues).toEqual([{ message: 'Threw: ~standard', path: [] }]);
  });
  test('H5 only stack exhaustion fails a whole union: any other RangeError fails its member', () => {
    const Throws = refine(int(), 'never', () => {
      throw new RangeError('Invalid array length');
    });
    expect(is(1, union([Throws, int()]))).toBe(true);
    expect(validate(1, union([Throws, int()]))).toEqual({ value: 1 });
    // A RangeError whose message cannot be read might be the stack's: fail closed, the whole check.
    const Unreadable = refine(int(), 'never', () => {
      throw Object.create(RangeError.prototype, {
        message: {
          get: (): never => {
            throw new Error('unreadable');
          },
        },
      }) as RangeError;
    });
    expect(validate(1, union([Unreadable, int()])).issues).toEqual([
      { message: 'Threw: RangeError', path: [] },
    ]);
    // An empty union has no member to accept.
    expect(is(1, union([]))).toBe(false);
  });
  test('H7 a container costs the same at any depth', () => {
    const Item = object({ a: int() });
    const Node: Schema = object({
      items: list(Item),
      get next(): Schema {
        return nullable(Node);
      },
    });
    const items = Array.from({ length: 300_000 }, () => ({ a: 1 }));
    const at = (levels: number): unknown =>
      chain(levels, (next) => ({ items: next === null ? items : [], next }));
    const shallow = at(1);
    const deep = at(500);
    expect(is(deep, Node)).toBe(true);
    // Once, each item scanned its 500 ancestors: 15–20× the shallow walk.
    expect(fastest(() => is(deep, Node))).toBeLessThan(4 * fastest(() => is(shallow, Node)));
  });
  test('H8 I2 J1 a discriminant is found by lookup, wherever its key sorts: behind a few leaf fields, or behind many', () => {
    const few = Array.from({ length: 200 }, (_value, at) =>
      object({
        at: int(),
        id: id(),
        name: string(),
        payload: object({ x: int() }),
        type: literal(`t${at}`),
      }),
    );
    // 100,000 rows each would try some 100 members: 10 million steps, were they tried in turn.
    const flat = Array.from({ length: 100_000 }, (_value, at) => ({
      at: 1,
      id: 'a',
      name: 'n',
      payload: { x: 1 },
      type: `t${at % 200}`,
    }));
    expect(validate(flat, list(union(few))).issues).toBeUndefined();
    expect(is(flat, list(union(few)))).toBe(true);
    const leaves = Object.fromEntries(
      Array.from({ length: 20 }, (_value, at) => [`f${at + 10}`, int()]),
    );
    const many = Array.from({ length: 100 }, (_value, at) =>
      object({ ...leaves, type: literal(`t${at}`) }),
    );
    const row = Object.fromEntries(Array.from({ length: 20 }, (_value, at) => [`f${at + 10}`, at]));
    const wide = Array.from({ length: 20_000 }, (_value, at) => ({
      ...row,
      type: `t${at % 100}`,
    }));
    expect(validate(wide, list(union(many))).issues).toBeUndefined();
    expect(is(wide, list(union(many)))).toBe(true);
  });
  test('H9 enums keeps a frozen copy of its values', () => {
    const values = ['A'];
    const Letter = enums(values);
    values.push('B');
    expect(is('B', Letter)).toBe(false);
    expect(Letter.def).toEqual({ kind: 'enum', values: ['A'] });
    expect(Object.isFrozen((Letter.def as { readonly values: unknown }).values)).toBe(true);
  });
});

// Findings of the 2026-09-28 final unanchored review #4; the id is its ledger entry.
describe('no verdict rests on the stack, and no union is free to try', () => {
  test('I1 a nested validation that exhausts the stack fails its whole call, whatever a callback made of it', async () => {
    const exhausted = 'Threw: stack exhausted';
    // Warmed code, and code no test has run: optimised, verax's calls may be inlined, leaving no edge between them.
    for (const verax of [{ is, list, refine, unknown, validate }, await copy('cold')]) {
      const Lists = verax.list(verax.unknown());
      let ends = 0;
      let relays = 0;
      // Inverts a nested verdict: only an exhausted one could accept.
      const Edge = verax.refine(verax.unknown(), 'not a list', (value) => {
        const message = verax.validate(value, Lists).issues?.[0]?.message;
        ends += Number(message === exhausted);
        relays += Number(message !== undefined && message !== exhausted);
        return !verax.is(value, Lists);
      });
      let wrong = 0;
      sweep(() => {
        ends = 0;
        const { issues } = verax.validate([1], Edge);
        // An exhausted nested call ends its whole call: never accepted, never outlived, never relayed.
        if (
          issues === undefined ||
          (ends > 0 && issues[0]?.message !== exhausted) ||
          verax.is([1], Edge)
        ) {
          wrong += 1;
        }
      });
      expect({ relays, wrong }).toEqual({ relays: 0, wrong: 0 });
    }
  });
  test('I2 every union member tried is a step: a wide tagged union over a shared list is Too complex, in bounded work', () => {
    let budget = steps(0);
    const Row = union([
      ...Array.from({ length: 99 }, (_value, at) => object({ id: id(), type: literal(`t${at}`) })),
      refine(object({ id: id(), type: literal('last') }), 'counted', () => budget.tick(true)),
    ]);
    // structuredClone keeps the sharing: 2,000 × 2,000 paths to one row.
    const row = { id: 'x', type: 'last' };
    const inner = Array.from({ length: 2000 }, () => row);
    const grid = structuredClone(Array.from({ length: 2000 }, () => inner));
    budget = steps(250_000);
    expect(is(grid, list(list(Row)))).toBe(false);
    expect(budget.calls).toBeLessThanOrEqual(250_000);
    budget = steps(250_000);
    expect(validate(grid, list(list(Row))).issues?.map(({ message }) => message)).toEqual([
      'Too complex',
    ]);
    expect(budget.calls).toBeLessThanOrEqual(250_000);
  });
});

/**
A seeded generator: the same cases on every run.
*/
const random = (seed: number): ((below: number) => number) => {
  let state = seed;
  return (below) => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return Math.floor((state / 2_147_483_648) * below);
  };
};

// FIX BATCH 8 decisions; the id is its ledger entry.
/**
The same members, each behind a refine that passes: never found by lookup, so tried in turn.
*/
const sequential = (members: readonly Schema[]): Schema =>
  union(members.map((member) => refine(member, 'never', () => true)));

/**
A value every generated member could read, but for its discriminant.
*/
const shaped = (tag: unknown): Record<string, unknown> => ({
  f0: 1,
  f1: 'x',
  f2: 'id',
  f3: 'X',
  k: tag,
  n: { x: 1 },
  v: 'same',
});

describe('a discriminated union finds its member by lookup, with the verdict of trying each', () => {
  const TAGS: readonly (bigint | boolean | number | string | null | undefined)[] = [
    'a',
    'b',
    '',
    0,
    -0,
    1,
    Number.NaN,
    null,
    undefined,
    true,
    0n,
  ];
  test('J1 lookup and trying each agree on verdicts, issues and outputs, over generated unions and hostile values', () => {
    const next = random(20_260_929);
    const pickOne = <TValue>(from: readonly TValue[]): TValue => from[next(from.length)] as TValue;
    let eligible = 0;
    let cases = 0;
    for (let round = 0; round < 400; round += 1) {
      const width = 1 + next(6);
      const tags = Array.from({ length: width }, () => pickOne(TAGS));
      const pure = [int(), string(), optional(id()), nullable(enums(['X', 'Y']))];
      const impure = [
        scalar('Odd', (value): value is number => value === 1),
        refine(int(), 'small', (value) => value < 5),
        coerce(int(), Number),
      ];
      /**
      Whether this round's members all run no callback before the discriminant.
      */
      let clean = true as boolean;
      const members: Schema[] = tags.map((tag, at) => {
        const entries: [string, Schema][] = [];
        for (let field = 0; field < next(4); field += 1) {
          const impureOne = next(5) === 0;
          clean &&= !impureOne;
          entries.push([`f${field}`, pickOne<Schema>(impureOne ? impure : pure)]);
        }
        entries.push(['k', literal(tag)]);
        if (next(3) === 0) {
          entries.push(['n', object({ x: int() })]);
        }
        if (next(4) === 0) {
          entries.push(['v', literal('same')]);
        }
        // A member not an object of its own, now and then: lookup is then off.
        if (next(25) === 0) {
          clean = false;
          return next(2) === 0
            ? refine(object(Object.fromEntries(entries)), 'r', () => true)
            : int();
        }
        return at % 2 === 0
          ? object(Object.fromEntries(entries))
          : { ...object(Object.fromEntries(entries)) };
      });
      // An undefined discriminant is never eligible: it can't tell absent from present.
      const distinct = new Set(tags).size === tags.length && !tags.includes(undefined);
      const Lookup = union(members);
      const Each = sequential(members);
      const values: unknown[] = [];
      for (const tag of [...tags, 'zz', 2, -0, 0, Number.NaN, undefined]) {
        const { f0, ...rest } = shaped(tag);
        const { k, ...missing } = shaped(tag);
        values.push(
          shaped(tag),
          rest,
          missing,
          { ...shaped(tag), extra: 1 },
          { f0: 1, k: tag },
          { k: tag },
          Object.assign(Object.create(null) as object, shaped(tag)),
          Object.create({ k: tag }) as unknown,
          [tag],
          new Date(0),
          new Map([['k', tag]]),
        );
      }
      values.push(null, undefined, 1, 'k');
      for (const value of values) {
        cases += 1;
        expect(is(value, Lookup)).toBe(is(value, Each));
        expect(validate(value, Lookup)).toEqual(validate(value, Each));
      }
      // A getter or proxy discriminant is read once by lookup — once per member tried in turn.
      for (const tag of tags) {
        let reads = 0;
        const getter = { ...shaped(tag) };
        Object.defineProperty(getter, 'k', {
          enumerable: true,
          get: (): unknown => {
            reads += 1;
            return tag;
          },
        });
        const proxy = new Proxy(shaped(tag), {
          get: (target, key, receiver): unknown => {
            if (key === 'k') {
              reads += 1;
            }
            return Reflect.get(target, key, receiver) as unknown;
          },
        });
        for (const value of [getter, proxy]) {
          reads = 0;
          const verdict = is(value, Lookup);
          const once = reads;
          reads = 0;
          expect(is(value, Each)).toBe(verdict);
          expect(validate(value, Lookup)).toEqual(validate(value, Each));
          if (!clean || !distinct) {
            continue;
          }
          eligible += 1;
          expect(once).toBe(1);
        }
      }
    }
    expect(cases).toBeGreaterThan(10_000);
    expect(eligible).toBeGreaterThan(100);
  });
  test('J1 only members that run no callback before the discriminant are found by lookup: a member tried in turn may change the value', () => {
    const value: Record<string, unknown> = { a: 1, k: 'z' };
    const Retags = scalar('Retags', (seen): seen is number => {
      value['k'] = 'b';
      return seen === 1;
    });
    const Either = union([
      object({ a: Retags, k: literal('a') }),
      object({ a: int(), k: literal('b') }),
    ]);
    // Tried in turn, the first member retags the value, and the second accepts it.
    expect(is(value, Either)).toBe(true);
  });
  test('J1 a callback that retags the value mid-check can only make lookup reject', () => {
    const value: Record<string, unknown> = { k: 'a', n: 1 };
    const members = [
      object({
        k: literal('a'),
        n: refine(int(), 'retags', () => {
          value['k'] = 'b';
          return false;
        }),
      }),
      object({ k: literal('b'), n: int() }),
    ];
    // Tried in turn, the second member reads the retagged value; lookup read 'a' once.
    expect(is(value, sequential(members))).toBe(true);
    value['k'] = 'a';
    expect(is(value, union(members))).toBe(false);
  });
  test('J1 lookup keeps what trying each rejects: 0 and -0 are distinct literals, and a refined member is not an object', () => {
    const Signed = union([object({ k: literal(0) }), object({ k: literal(-0), x: int() })]);
    // Tried in turn: each member fails one field below, and the first is closest.
    expect(validate({ k: -0 }, Signed).issues).toEqual([
      { message: 'Expected 0, received -0', path: ['k'] },
    ]);
    expect(Object.is(parse({ k: -0, x: 1 }, Signed).k, -0)).toBe(true);
    expect(is({ k: 0 }, Signed)).toBe(true);
    const Zero = union([object({ k: literal(0) }), object({ k: literal(1) })]);
    expect(is({ k: -0 }, Zero)).toBe(false);
    const Refined = union([
      refine(object({ k: literal('a') }), 'never', () => false),
      object({ k: literal('b') }),
    ]);
    expect(is({ k: 'a' }, Refined)).toBe(false);
    // A shape getter that throws is its member's failure, until it reads.
    let broken = true;
    const Late = union([
      object({ k: literal('a') }),
      object({
        get k(): Schema {
          if (broken) {
            throw new Error('not yet');
          }
          return literal('b');
        },
      }),
    ]);
    expect(is({ k: 'a' }, Late)).toBe(true);
    expect(is({ k: 'b' }, Late)).toBe(false);
    broken = false;
    expect(is({ k: 'b' }, Late)).toBe(true);
  });
  test('J1 finding members never swallows stack exhaustion: met reading their shapes, it fails the check', () => {
    // As a shape read at the stack's edge throws; swallowed, a nested verdict retried beside it could be inverted.
    let exhausted = true;
    const Edge = union([
      object({ t: literal('a') }),
      object({
        get t(): Schema {
          if (exhausted) {
            throw new RangeError('Maximum call stack size exceeded');
          }
          return literal('b');
        },
      }),
    ]);
    expect(validate({ t: 'a' }, Edge).issues).toEqual([
      { message: 'Threw: Maximum call stack size exceeded', path: [] },
    ]);
    expect(is({ t: 'a' }, Edge)).toBe(false);
    exhausted = false;
    expect(is({ t: 'a' }, Edge)).toBe(true);
    expect(is({ t: 'b' }, Edge)).toBe(true);
  });
  test('J1 a discriminant costs one step per value, whatever the union width: 200 members fit what one does', () => {
    for (const width of [1, 200]) {
      const members = Array.from({ length: width }, (_value, at) =>
        object({ k: literal(`t${at}`) }),
      );
      const U = union(members);
      // A list of n rows of one field is 3n + 1 steps: a match costs its row, a miss one step.
      const found = { k: `t${width - 1}` };
      const Maybe = list(union([U, literal(null)]));
      for (const [value, schemaOf] of [
        [found, list(U)],
        [null, Maybe],
      ] as const) {
        expect(
          is(
            Array.from({ length: 3_333_333 }, () => value),
            schemaOf,
          ),
        ).toBe(true);
        expect(
          is(
            Array.from({ length: 3_333_334 }, () => value),
            schemaOf,
          ),
        ).toBe(false);
      }
    }
  });
  test('J2 validate at the stack edge: an overflow in finding the schema is an issue, never a throw from within', () => {
    const Point = object({ x: int() });
    for (const entry of [
      (value: unknown): unknown => validate(value, Point),
      (value: unknown): unknown => Point['~standard'].validate(value),
    ]) {
      // A throw that left a frame of verax escaped from within; one from the caller's own call did not.
      let within = 0;
      sweep(() => {
        try {
          return entry({ x: 1 });
        } catch (error) {
          within += Number(
            /core\.ts|types\.ts/u.test((error as Error).stack?.split('\n', 2)[1] ?? ''),
          );
          throw error;
        }
      });
      expect(within).toBe(0);
    }
  });
});

describe('review 5', () => {
  test('F1 an undefined discriminant is tried in turn: a re-entrant read keeps a present key', () => {
    const members = [
      object({ k: literal(undefined), y: int() }),
      object({ k: literal('d'), y: int() }),
    ];
    const Lookup = union(members);
    const Each = union(members.map((member) => refine(member, 'r', () => true)));
    for (const Union of [Lookup, Each]) {
      const result = validate(
        {
          get k(): undefined {
            validate({ y: 1 }, Union);
            return undefined;
          },
          y: 1,
        },
        Union,
      );
      expect(result.issues).toBeUndefined();
      expect(Object.keys('value' in result ? (result.value as object) : {})).toEqual(['k', 'y']);
    }
  });
});

// record (owner 2026-10-01): the guarantees object keeps, for any keys.
/**
`seed` wrapped `levels` times.
*/
const nest = <TValue>(levels: number, wrap: (inner: TValue) => TValue, seed: TValue): TValue => {
  let made = seed;
  for (let level = 0; level < levels; level += 1) {
    made = wrap(made);
  }
  return made;
};

describe('record keeps the guarantees object does', () => {
  const Counts = record(int());
  test('a record of n keys is n + 1 steps, along every path to a shared one', () => {
    const shared = Object.fromEntries(Array.from({ length: 999 }, (_value, at) => [`k${at}`, at]));
    // (k + 1) + k × 1,000: 9,990 paths fit 10 million steps, 9,991 do not.
    expect(
      is(
        Array.from({ length: 9990 }, () => shared),
        list(Counts),
      ),
    ).toBe(true);
    const over = Array.from({ length: 9991 }, () => shared);
    expect(is(over, list(Counts))).toBe(false);
    expect(validate(over, list(Counts)).issues?.map(({ message }) => message)).toEqual([
      'Too complex',
    ]);
  });
  test('a record failing in a union member is never free: every key enumerated counts, read or not, past the free leaf reads', () => {
    const keys = Array.from({ length: 10_000 }, (_value, at) => `k${at}`);
    const lateBad = Object.fromEntries(keys.map((key, at) => [key, at === 9999 ? 'x' : at]));
    const earlyBad = Object.fromEntries(keys.map((key, at) => [key, at === 0 ? 'x' : at]));
    let budget = steps(0);
    const counted = refine(unknown(), 'counted', (value) => budget.tick(value) !== null);
    const Thrown = refine(int(), 'never', () => {
      throw new Error('thrown');
    });
    for (const [Member, wide] of [
      [Counts, lateBad],
      [Counts, earlyBad],
      [record(nullable(object({}))), earlyBad],
      [record(Thrown), lateBad],
    ] as const) {
      const Owned = list(union([Member, counted]));
      const owned = Array.from({ length: 1_000_000 }, () => wide);
      budget = steps(5000);
      expect(is(owned, Owned)).toBe(false);
      expect(budget.calls).toBeLessThanOrEqual(5000);
      budget = steps(5000);
      expect(validate(owned, Owned).issues?.map(({ message }) => message)).toEqual(['Too complex']);
      expect(budget.calls).toBeLessThanOrEqual(5000);
      budget = steps(5000);
      expect(is(owned.slice(0, 100), Owned)).toBe(true);
    }
  });
  test('a leaf value failing wastes nothing: 30 members failing late, tried in turn, stay within the budget', () => {
    // 49 ints, a string, 10 ints: each record(int()) member fails at its 50th key.
    const row = Object.fromEntries(
      Array.from({ length: 60 }, (_value, at) => [`k${at}`, at === 49 ? 'x' : at]),
    );
    const Row = union([...Array.from({ length: 30 }, () => Counts), record(unknown())]);
    // Counted as waste, 6,000 rows would be Too complex (past some 5,200); counted as reads, they fit.
    const rows = Array.from({ length: 6000 }, () => row);
    expect(is(rows, list(Row))).toBe(true);
    expect(validate(rows, list(Row)).issues).toBeUndefined();
  });
  test('a record is a container: past 512 nested, Too deep, the same as lists', () => {
    for (const levels of [512, 513]) {
      const Records = nest<Schema>(levels, (inner) => record(inner), int());
      const Lists = nest<Schema>(levels, (inner) => list(inner), int());
      const records = nest<unknown>(levels, (inner) => ({ k: inner }), 1);
      const lists = nest<unknown>(levels, (inner) => [inner], 1);
      expect(is(records, Records)).toBe(levels === 512);
      expect(is(records, Records)).toBe(is(lists, Lists));
      expect(validate(records, Records).issues?.[0]?.message).toBe(
        levels === 512 ? undefined : 'Too deep',
      );
    }
    expect(stackDepth()).toBe(0);
  });
  test('issues stop at 100', () => {
    const bad = Object.fromEntries(Array.from({ length: 300 }, (_value, at) => [`k${at}`, 'x']));
    const issues = validate(bad, Counts).issues ?? [];
    expect(issues).toHaveLength(100);
    expect(issues[99]?.path).toEqual(['k99']);
  });
  test('hostile values are issues, never throws: getters, proxies, revoked proxies', () => {
    const getter = {
      a: 1,
      get b(): never {
        throw new Error('boom');
      },
    };
    expect(is(getter, Counts)).toBe(false);
    expect(validate(getter, Counts).issues).toEqual([{ message: 'Threw: boom', path: ['b'] }]);
    const keyless = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('no keys');
        },
      },
    );
    expect(is(keyless, Counts)).toBe(false);
    expect(validate(keyless, Counts).issues).toEqual([{ message: 'Threw: no keys', path: [] }]);
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(is(proxy, Counts)).toBe(false);
    expect(validate(proxy, Counts).issues?.[0]?.message).toMatch(/^Threw: /u);
    expect(stackDepth()).toBe(0);
  });
  test('inherited enumerable keys are never read, and a key deleted mid-walk is never visited', () => {
    const value: Record<string, unknown> = {
      get a(): number {
        delete value['b'];
        return 1;
      },
      b: 'x',
    };
    expect(parse(value, Counts)).toEqual({ a: 1 });
    expect(is(Object.create({ a: 'x' }), Counts)).toBe(false);
  });
  test('enumerable keys polluting Object.prototype are never read', () => {
    const prototype = Object.prototype as Record<string, unknown>;
    prototype['polluted'] = 'x';
    try {
      expect(parse({ a: 1 }, Counts)).toEqual({ a: 1 });
      expect(Object.hasOwn(parse({ a: 1 }, Counts), 'polluted')).toBe(false);
      expect(paths(validate({ a: 'x' }, Counts))).toEqual([['a']]);
    } finally {
      delete prototype['polluted'];
    }
  });
  test('a union with a record member is tried in turn, never found by lookup', () => {
    const Either = union([object({ type: literal('a') }), record(string())]);
    expect(parse({ type: 'a' }, Either)).toEqual({ type: 'a' });
    expect(parse({ type: 'b' }, Either)).toEqual({ type: 'b' });
    expect(is({ type: 1 }, Either)).toBe(false);
  });
});

describe('a failed union explains itself within the budget', () => {
  test('U4 only the outermost untagged union explains, and a union nested in a member tried is taken to pass: linear in width and depth', () => {
    const levels = 511;
    const cost = (width: number): { calls: number; issues: readonly Issue[] | undefined } => {
      const budget = steps(Infinity);
      // Member 0's tag passes at every level: its fast check descends; the rest fail on the tag.
      const Link: Schema = union(
        Array.from({ length: width }, (_value, at) =>
          object({
            get next(): Schema {
              return coerce(nullable(Link), budget.tick);
            },
            [`t${at}`]: literal(1),
          }),
        ),
      );
      const value = chain(levels, (next) => ({ next: next ?? 'bottom', t0: 1 }));
      const { issues } = validate(value, Link);
      return { calls: budget.calls, issues };
    };
    const [narrow, wide] = [cost(3), cost(400)];
    for (const { issues } of [narrow, wide]) {
      expect(issues).toEqual([
        { message: 'Expected union member, received object', path: ['next'] },
      ]);
    }
    // A pass to judge, one to find issues, one for the closest's: 3 per level, and one per member tried.
    expect(narrow.calls).toBeLessThanOrEqual(3 * (levels + 1) + 3);
    expect(wide.calls).toBeLessThanOrEqual(3 * (levels + 1) + 400);
  });
  test('U4 an explanation that runs past the budget is undone: the mismatch stands, and the rest of the call is judged as before', () => {
    const budget = steps(Infinity);
    // `items` before the tag: each member tried walks the whole list before failing.
    const members = Array.from({ length: 40 }, (_value, at) =>
      object({ items: list(coerce(int(), budget.tick)), [`t${at}`]: literal(1) }),
    );
    const items = Array.from({ length: 50_000 }, (_value, at) => at);
    expect(
      validate({ first: { items }, second: 'x' }, object({ first: union(members), second: int() }))
        .issues,
    ).toEqual([
      { message: 'Expected union member, received object', path: ['first'] },
      { message: 'Expected Int, received "x"', path: ['second'] },
    ]);
    // Short of every member's full walk, 2 million items.
    expect(budget.calls).toBeLessThanOrEqual(1_200_000);
    // A nested call never explains: its caller's verdict is still open, and shares the budget.
    const Logs = refine(
      unknown(),
      'logs',
      (value) => validate(value, union(members)).issues !== undefined,
    );
    expect(validate({ items }, Logs)).toEqual({ value: { items } });
  });
});

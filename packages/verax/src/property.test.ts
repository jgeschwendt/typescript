// Differential property tests: the public API against an independent reference
// model. A schema is generated as a plain-data description, compiled to verax,
// and judged by `reference`, a slow, obviously-correct interpreter of the
// README's semantics. A failure prints its seed: replay with FC_SEED=<seed>.
import { describe, expect, test } from 'bun:test';
import * as fc from 'fast-check';
import {
  type Schema,
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
} from './index.js';

// ─── schema descriptions ─────────────────────────────────────────────────────────────────────────

type Primitive = bigint | boolean | number | string | null | undefined;
type Shape = readonly (readonly [string, Desc])[];
type Desc =
  | { readonly kind: 'boolean' }
  | { readonly kind: 'coerce'; readonly of: Desc; readonly convert: Convert }
  | { readonly kind: 'enums'; readonly values: readonly string[] }
  | { readonly kind: 'float' }
  | { readonly kind: 'id' }
  | { readonly kind: 'int' }
  | { readonly kind: 'list'; readonly of: Desc }
  | { readonly kind: 'literal'; readonly value: Primitive }
  | { readonly kind: 'nullable'; readonly of: Desc }
  | { readonly kind: 'object'; readonly shape: Shape }
  | { readonly kind: 'optional'; readonly of: Desc }
  | { readonly kind: 'record'; readonly of: Desc }
  | { readonly kind: 'refine'; readonly of: Desc; readonly test: Predicate }
  | { readonly kind: 'scalar'; readonly guard: Guard }
  | { readonly kind: 'string' }
  | { readonly kind: 'union'; readonly of: readonly Desc[] }
  | { readonly kind: 'unknown' };

/**
One handler per description kind; `dispatch` routes a description to its own.
*/
type Table<TResult, TRest extends unknown[]> = {
  readonly [TKind in Desc['kind']]: (
    desc: Desc & { readonly kind: TKind },
    ...rest: TRest
  ) => TResult;
};
const dispatch = <TResult, TRest extends unknown[]>(
  table: Table<TResult, TRest>,
  desc: Desc,
  ...rest: TRest
): TResult => (table[desc.kind] as (desc: Desc, ...rest: TRest) => TResult)(desc, ...rest);

/**
A revoked proxy: every operation on it throws, `Array.isArray` included.
*/
const revoked = (target: object = {}): object => {
  const { proxy, revoke } = Proxy.revocable(target, {});
  revoke();
  return proxy;
};

/**
An `Error` whose `message` getter throws — hostile to whoever explains it.
*/
const hostileError = (): Error =>
  Object.create(Error.prototype, {
    message: {
      get: () => {
        throw new Error('message getter');
      },
    },
  }) as Error;

const boom = (kind: 'error' | 'hostileError' | 'revoked' | 'string'): never => {
  switch (kind) {
    case 'error': {
      throw new Error('boom');
    }
    case 'hostileError': {
      throw hostileError();
    }
    case 'revoked': {
      throw revoked();
    }
    case 'string': {
      throw 'boom';
    }
  }
};

// Pure callbacks, by name, so a failing description prints readably.
const GUARDS = {
  Even: (value: unknown): value is number => typeof value === 'number' && value % 2 === 0,
  Throwing: (value: unknown): value is never => value === boom('error'),
  Upper: (value: unknown): value is string =>
    typeof value === 'string' && value === value.toUpperCase(),
} as const;
type Guard = keyof typeof GUARDS;

const PREDICATES = {
  nonEmpty: (value: unknown): boolean =>
    typeof value === 'string' || Array.isArray(value) ? value.length > 0 : true,
  notZero: (value: unknown): boolean => value !== 0,
  throwsHostile: (): boolean => boom('hostileError'),
  truthy: Boolean,
} as const;
type Predicate = keyof typeof PREDICATES;

const CONVERTERS = {
  constant: (): unknown => 'k',
  defaultZero: (value: unknown): unknown => value ?? 0,
  numberFromString: (value: unknown): unknown =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  stringFromNumber: (value: unknown): unknown =>
    typeof value === 'number' ? String(value) : value,
  throwsRevoked: (): unknown => boom('revoked'),
  throwsString: (): unknown => boom('string'),
  wrapList: (value: unknown): unknown => (Array.isArray(value) ? value : [value]),
} as const;
type Convert = keyof typeof CONVERTERS;

// ─── the reference model ─────────────────────────────────────────────────────────────────────────

type Verdict = { readonly ok: false } | { readonly ok: true; readonly out: unknown };
const REJECT: Verdict = { ok: false };
const accept = (out: unknown): Verdict => ({ ok: true, out });
/**
Accepts `value` as its own output when `ok`.
*/
const when = (ok: boolean, value: unknown): Verdict => (ok ? accept(value) : REJECT);

const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;

/**
The containers the model built: verax's output must hold a fresh plain one at each.
*/
const MADE = new WeakSet<object>();
const made = <TValue extends object>(value: TValue): TValue => {
  MADE.add(value);
  return value;
};

/**
`{}` or `Object.create(null)` of this realm: the prototype is `Object.prototype` or null.
*/
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
Defines, never assigns: a key named "__proto__" stays a key.
*/
const setField = (target: object, key: string, value: unknown): void => {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const judgeList = (of: Desc, value: unknown): Verdict => {
  if (!Array.isArray(value)) {
    return REJECT;
  }
  const out: unknown[] = made([]);
  // Every index below length — a hole reads as `undefined` — and the value's own iterator never runs.
  for (let index = 0; index < value.length; index += 1) {
    const item = judge(of, value[index]);
    if (!item.ok) {
      return REJECT;
    }
    out.push(item.out);
  }
  return accept(out);
};

/**
Each field against its own key, or `undefined` if the object does not own it.
*/
const judgeFields = (shape: Shape, target: Record<string, unknown>): Verdict => {
  const out = made({});
  for (const [key, field] of shape) {
    const present = Object.hasOwn(target, key);
    const verdict = judge(field, present ? target[key] : undefined);
    if (!verdict.ok) {
      return REJECT;
    }
    // An absent key reaches the output only when its schema made a value.
    if (present || verdict.out !== undefined) {
      setField(out, key, verdict.out);
    }
  }
  return accept(out);
};

const judgeObject = (shape: Shape, value: unknown): Verdict => {
  if (!isPlainObject(value)) {
    return REJECT;
  }
  const known = new Set(shape.map(([key]) => key));
  if (Object.keys(value).some((key) => !known.has(key))) {
    return REJECT;
  }
  return judgeFields(shape, value);
};

/**
Every own enumerable string key, in `Object.keys` order, against `of`.
*/
const judgeRecord = (of: Desc, value: unknown): Verdict => {
  if (!isPlainObject(value)) {
    return REJECT;
  }
  const out = made({});
  for (const key of Object.keys(value)) {
    const verdict = judge(of, value[key]);
    if (!verdict.ok) {
      return REJECT;
    }
    setField(out, key, verdict.out);
  }
  return accept(out);
};

const judgeUnion = (members: readonly Desc[], value: unknown): Verdict => {
  for (const member of members) {
    try {
      const verdict = judge(member, value);
      if (verdict.ok) {
        return verdict;
      }
    } catch {
      // A member that throws is a member that failed.
    }
  }
  return REJECT;
};

const JUDGES: Table<Verdict, [unknown]> = {
  boolean: (_desc, value) => when(typeof value === 'boolean', value),
  coerce: (desc, value) => judge(desc.of, CONVERTERS[desc.convert](value)),
  enums: (desc, value) => when(typeof value === 'string' && desc.values.includes(value), value),
  float: (_desc, value) => when(typeof value === 'number' && Number.isFinite(value), value),
  id: (_desc, value) => when(typeof value === 'string', value),
  int: (_desc, value) =>
    when(
      typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= INT_MIN &&
        value <= INT_MAX,
      value,
    ),
  list: (desc, value) => judgeList(desc.of, value),
  literal: (desc, value) => when(Object.is(value, desc.value), value),
  nullable: (desc, value) => (value === null ? accept(null) : judge(desc.of, value)),
  object: (desc, value) => judgeObject(desc.shape, value),
  optional: (desc, value) => (value === undefined ? accept(value) : judge(desc.of, value)),
  record: (desc, value) => judgeRecord(desc.of, value),
  refine: (desc, value) => {
    const inner = judge(desc.of, value);
    return inner.ok && PREDICATES[desc.test](inner.out) ? inner : REJECT;
  },
  scalar: (desc, value) => when(GUARDS[desc.guard](value), value),
  string: (_desc, value) => when(typeof value === 'string', value),
  union: (desc, value) => judgeUnion(desc.of, value),
  unknown: (_desc, value) => accept(value),
};

/**
Judges `value` against `desc`. May throw — a hostile value or callback — and
a throw rejects the nearest enclosing union member, or the whole value.
*/
const judge = (desc: Desc, value: unknown): Verdict => dispatch(JUDGES, desc, value);

const reference = (desc: Desc, value: unknown): Verdict => {
  try {
    return judge(desc, value);
  } catch {
    return REJECT;
  }
};

/**
Deep equality over what data consumers see: own enumerable string keys, and
list indices below length (a hole reads as `undefined`). Prototypes,
non-enumerable keys and non-index list properties are ignored; -0 vs 0 and a
missing key vs an `undefined` one still differ.
*/
const sameProjection = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null ||
    Array.isArray(left) !== Array.isArray(right)
  ) {
    return false;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      [...left.keys()].every((index) => sameProjection(left[index], right[index]))
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = new Set(Object.keys(rightRecord));
  return (
    leftKeys.length === rightKeys.size &&
    leftKeys.every((key) => rightKeys.has(key) && sameProjection(leftRecord[key], rightRecord[key]))
  );
};

/**
Every object reachable from `root` through own enumerable keys.
*/
const reachable = (root: unknown): ReadonlySet<object> => {
  const found = new Set<object>();
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || found.has(value)) {
      return;
    }
    found.add(value);
    for (const key of Object.keys(value)) {
      visit((value as Record<string, unknown>)[key]);
    }
  };
  visit(root);
  return found;
};

/**
Where the model built a container, `output` holds a fresh one — a plain
object or array, none of the input's own — with the same keys in the same
order; everywhere else it matches the model on the projection.
*/
const mirrors = (model: unknown, output: unknown, inputs: ReadonlySet<object>): boolean => {
  if (typeof model !== 'object' || model === null || !MADE.has(model)) {
    return sameProjection(model, output);
  }
  if (typeof output !== 'object' || output === null || inputs.has(output)) {
    return false;
  }
  const prototype = Array.isArray(model) ? Array.prototype : Object.prototype;
  if (Object.getPrototypeOf(output) !== prototype) {
    return false;
  }
  const modelRecord = model as Record<string, unknown>;
  const outputRecord = output as Record<string, unknown>;
  const keys = Object.keys(modelRecord);
  const outputKeys = Object.keys(outputRecord);
  return (
    keys.length === outputKeys.length &&
    keys.every(
      (key, at) => outputKeys[at] === key && mirrors(modelRecord[key], outputRecord[key], inputs),
    )
  );
};

// ─── description → verax ─────────────────────────────────────────────────────────────────────────

const COMPILERS: Table<Schema, []> = {
  boolean: () => boolean(),
  coerce: (desc) => coerce(compile(desc.of), CONVERTERS[desc.convert]),
  enums: (desc) => enums(desc.values),
  float: () => float(),
  id: () => id(),
  int: () => int(),
  list: (desc) => list(compile(desc.of)),
  literal: (desc) => literal(desc.value),
  nullable: (desc) => nullable(compile(desc.of)),
  // fromEntries defines own keys: a field named "__proto__" stays a field.
  object: (desc) =>
    object(Object.fromEntries(desc.shape.map(([key, field]) => [key, compile(field)]))),
  optional: (desc) => optional(compile(desc.of)),
  record: (desc) => record(compile(desc.of)),
  refine: (desc) => refine(compile(desc.of), `refine ${desc.test}`, PREDICATES[desc.test]),
  scalar: (desc) => scalar(desc.guard, GUARDS[desc.guard] as (value: unknown) => value is unknown),
  string: () => string(),
  union: (desc) => union(desc.of.map((member) => compile(member))),
  unknown: () => unknown(),
};

const compile = (desc: Desc): Schema => dispatch(COMPILERS, desc);

// ─── description arbitraries ─────────────────────────────────────────────────────────────────────

const MAX_DEPTH = 4;
const MAX_FIELDS = 4;
const MAX_MEMBERS = 3;
const MAX_ITEMS = 3;
const MAX_TEXT = 4;
const SMALL_INT = 100;
/**
Weight of the usual choice against one: a rare branch fires about 1 in (N + 1).
*/
const USUALLY = 9;

const KEYS = ['a', 'b', 'c', 'type', '__proto__', 'constructor', 'toString', '0', 'length'];
const ENUM_VALUES = ['A', 'B', 'C', '__proto__', 'constructor', 'toString', ''];
const LITERALS: readonly Primitive[] = [
  null,
  undefined,
  0,
  -0,
  Number.NaN,
  1,
  INT_MAX + 1,
  '',
  'a',
  'A',
  true,
  false,
  1n,
];

/**
Picks from `common`, and from `rare` (the throwing callbacks) about one time in ten.
*/
const rarely = <TName extends string>(
  common: readonly TName[],
  rare: readonly TName[],
): fc.Arbitrary<TName> =>
  fc.oneof(
    { arbitrary: fc.constantFrom(...common), weight: USUALLY },
    { arbitrary: fc.constantFrom(...rare), weight: 1 },
  );

const leafDesc: fc.Arbitrary<Desc> = fc.oneof(
  fc.constantFrom<Desc>(
    { kind: 'boolean' },
    { kind: 'float' },
    { kind: 'id' },
    { kind: 'int' },
    { kind: 'string' },
    { kind: 'unknown' },
  ),
  fc.constantFrom(...LITERALS).map((value): Desc => ({ kind: 'literal', value })),
  fc
    .uniqueArray(fc.constantFrom(...ENUM_VALUES), {
      maxLength: MAX_MEMBERS,
      minLength: 1,
    })
    .map((values): Desc => ({ kind: 'enums', values })),
  rarely<Guard>(['Even', 'Upper'], ['Throwing']).map((guard): Desc => ({
    guard,
    kind: 'scalar',
  })),
);

const shapeOf = (field: fc.Arbitrary<Desc>): fc.Arbitrary<Shape> =>
  fc.uniqueArray(fc.tuple(fc.constantFrom(...KEYS), field), {
    maxLength: MAX_FIELDS,
    selector: ([key]) => key,
  });

/**
Object members tagged by a literal `type` field — a discriminated union.
*/
const taggedUnion = (field: fc.Arbitrary<Desc>): fc.Arbitrary<Desc> =>
  fc
    .uniqueArray(fc.constantFrom('x', 'y', 'z'), {
      maxLength: MAX_MEMBERS,
      minLength: 1,
    })
    .chain((tags) =>
      fc.tuple(...tags.map(() => shapeOf(field))).map((shapes): Desc => ({
        kind: 'union',
        of: shapes.map((shape, index) => ({
          kind: 'object',
          shape: [
            ['type', { kind: 'literal', value: tags[index] }],
            ...shape.filter(([key]) => key !== 'type'),
          ],
        })),
      })),
    );

const { desc: descArb } = fc.letrec<{ desc: Desc }>((tie) => {
  const inner = tie('desc');
  return {
    desc: fc.oneof(
      { depthSize: 'small', maxDepth: MAX_DEPTH },
      { arbitrary: leafDesc, weight: 4 },
      {
        arbitrary: fc
          .tuple(fc.constantFrom('list', 'nullable', 'optional', 'record'), inner)
          .map(([kind, of]): Desc => ({ kind, of })),
        weight: 3,
      },
      {
        arbitrary: shapeOf(inner).map((shape): Desc => ({
          kind: 'object',
          shape,
        })),
        weight: 3,
      },
      {
        arbitrary: fc
          .array(inner, { maxLength: MAX_MEMBERS, minLength: 1 })
          .map((of): Desc => ({ kind: 'union', of })),
        weight: 2,
      },
      { arbitrary: taggedUnion(inner), weight: 2 },
      {
        arbitrary: fc
          .tuple(inner, rarely<Predicate>(['nonEmpty', 'notZero', 'truthy'], ['throwsHostile']))
          .map(([of, predicate]): Desc => ({
            kind: 'refine',
            of,
            test: predicate,
          })),
        weight: 1,
      },
      {
        arbitrary: fc
          .tuple(
            inner,
            rarely<Convert>(
              ['constant', 'defaultZero', 'numberFromString', 'stringFromNumber', 'wrapList'],
              ['throwsRevoked', 'throwsString'],
            ),
          )
          .map(([of, convert]): Desc => ({ convert, kind: 'coerce', of })),
        weight: 1,
      },
    ),
  };
});

// ─── value arbitraries, biased toward the schema ─────────────────────────────────────────────────

// Values are recipes, built fresh per run: fast-check probes and prints what it generates, and a revoked proxy or poisoned getter would throw inside it.

interface Recipe {
  readonly make: () => unknown;
  readonly show: string;
  readonly [fc.toStringMethod]: () => string;
}
const recipe = (show: string, make: () => unknown): Recipe => ({
  make,
  show,
  [fc.toStringMethod]: () => show,
});
const plain = (value: unknown): Recipe => recipe(fc.stringify(value), () => value);

const UNDEFINED = plain(undefined);

type Named = readonly (readonly [string, () => unknown])[];

const EDGES: Named = [
  ['undefined', UNDEFINED.make],
  ['null', () => null],
  ['true', () => true],
  ['false', () => false],
  ['0', () => 0],
  ['-0', () => -0],
  ['0.5', () => 1 / 2],
  ['NaN', () => Number.NaN],
  ['Infinity', () => Number.POSITIVE_INFINITY],
  ['-Infinity', () => Number.NEGATIVE_INFINITY],
  ['2^31-1', () => INT_MAX],
  ['2^31', () => INT_MAX + 1],
  ['-2^31', () => INT_MIN],
  ['-2^31-1', () => INT_MIN - 1],
  ['1n', () => 1n],
  ['""', () => ''],
  ['"12"', () => '12'],
  ['"A"', () => 'A'],
  ['"constructor"', () => 'constructor'],
  ['"length"', () => 'length'],
  ['Symbol', () => Symbol('s')],
  ['function', () => (): null => null],
  ['[]', () => []],
  ['[undefined]', () => [UNDEFINED.make()]],
  [
    '[,1]',
    () => {
      const holey: unknown[] = [];
      holey[1] = 1;
      return holey;
    },
  ],
  ['{}', () => ({})],
  [
    '{a:1,type:"x"}',
    (): unknown =>
      Object.fromEntries([
        ['a', 1],
        ['type', 'x'],
      ]),
  ],
  ['create(null)', () => Object.create(null) as unknown],
  ['create({a:1})', () => Object.create(Object.fromEntries([['a', 1]])) as unknown],
  [
    'json {__proto__,constructor}',
    (): unknown => JSON.parse('{"__proto__":{"a":1},"constructor":1}'),
  ],
  ['Date', () => new Date(0)],
  ['Map', () => new Map()],
];

/**
Throw on touch: whole-value traps and poisoned reads.
*/
const HOSTILE: Named = [
  ['revoked {}', () => revoked()],
  ['revoked []', () => revoked([])],
  [
    'trapping proxy',
    () =>
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor: () => boom('error'),
          getPrototypeOf: () => boom('revoked'),
          ownKeys: () => boom('hostileError'),
        },
      ),
  ],
  [
    '[1, <throwing getter>]',
    () =>
      Object.defineProperty([1, 2], 1, {
        enumerable: true,
        get: () => boom('string'),
      }),
  ],
];

const edgeArb = (hostile: boolean): fc.Arbitrary<Recipe> =>
  fc.constantFrom(...EDGES, ...(hostile ? HOSTILE : [])).map(([show, make]) => recipe(show, make));

/**
A throwing getter under `key`: `Object.keys` sees it; reading it throws.
*/
const poison = (target: object, key: string): object =>
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get: () => boom('hostileError'),
  });

const OBJECT_FORMS = [
  ...Array.from({ length: USUALLY }, () => 'literal' as const),
  'accessor',
  'class',
  'hidden',
  'inherited',
  'json',
  'nestedRoot',
  'nullProto',
  'objectChild',
  'self',
] as const;
type ObjectForm = (typeof OBJECT_FORMS)[number];

const PROTOS: Readonly<Record<ObjectForm, () => object | null>> = {
  accessor: () => Object.prototype,
  class: () => Object.create(Object.prototype, { tag: { value: 'class' } }) as object,
  hidden: () => Object.prototype,
  inherited: () => Object.create(null) as object,
  json: () => Object.prototype,
  literal: () => Object.prototype,
  nestedRoot: () => Object.create(Object.create(null) as object) as object,
  nullProto: () => null,
  objectChild: () => ({ inherited: 1 }),
  self: () => Object.prototype,
};

/**
Places one field; `form` is the record's form for its first field, else `literal`.
*/
const placeField = (
  form: ObjectForm,
  { proto, target }: { readonly proto: object | null; readonly target: object },
  [key, value]: readonly [string, unknown],
): void => {
  if (form === 'inherited' && proto) {
    // The prototype has it; the object does not own it.
    setField(proto, key, value);
  } else if (form === 'accessor') {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      get: () => value,
    });
  } else {
    setField(target, key, value);
  }
};

/**
Builds an object of `form` from present entries; the first entry carries the form's twist.
*/
const buildObject = (
  form: ObjectForm,
  entries: readonly (readonly [string, Recipe])[],
  poisoned: string | null,
): object => {
  const prototype = PROTOS[form]();
  // A JSON-parsed object carries an own "__proto__" key.
  const target =
    form === 'json'
      ? (JSON.parse('{"__proto__":1}') as object)
      : (Object.create(prototype) as object);
  for (const [index, [key, field]] of entries.entries()) {
    placeField(index === 0 ? form : 'literal', { proto: prototype, target }, [key, field.make()]);
  }
  if (form === 'hidden') {
    Object.defineProperty(target, 'hidden', { enumerable: false, value: 1 });
  } else if (form === 'self') {
    setField(target, entries.at(0)?.[0] ?? 'a', target);
  }
  return poisoned === null ? target : poison(target, poisoned);
};

const LIST_BUILDERS = {
  arrayLike: (array: unknown[]): unknown =>
    Object.fromEntries([...array.entries(), ['length', array.length]]),
  dense: (array: unknown[]): unknown => array,
  extra: (array: unknown[]): unknown => Object.assign(array, { extra: 1 }),
  hole: (array: unknown[]): unknown => {
    array.length += 1;
    return array;
  },
  self: (array: unknown[]): unknown => {
    array.push(array);
    return array;
  },
} as const;
const LIST_FORMS = [
  ...Array.from({ length: USUALLY }, () => 'dense' as const),
  'arrayLike',
  'extra',
  'hole',
  'self',
] as const;

const ABSENT = 'absent';

const objectNear = (shape: Shape, hostile: boolean): fc.Arbitrary<Recipe> => {
  const field = (
    key: string,
    child: Desc,
  ): fc.Arbitrary<readonly [string, Recipe | typeof ABSENT]> =>
    fc
      .oneof(
        { arbitrary: near(child, hostile), weight: USUALLY },
        { arbitrary: fc.constant(ABSENT), weight: 1 },
      )
      .map((value) => [key, value] as const);
  const extras = fc.oneof(
    { arbitrary: fc.constant([]), weight: USUALLY },
    {
      arbitrary: fc.array(fc.tuple(fc.constantFrom(...KEYS, 'extra'), edgeArb(hostile)), {
        maxLength: 2,
        minLength: 1,
      }),
      weight: 1,
    },
  );
  return fc
    .tuple(
      fc.constantFrom(...OBJECT_FORMS),
      fc.tuple(...shape.map(([key, child]) => field(key, child))),
      extras,
      hostile ? fc.option(fc.constantFrom(...KEYS)) : fc.constant(null),
    )
    .map(([form, fields, extra, poisoned]) => {
      const entries = [...fields, ...extra].filter(
        (entry): entry is readonly [string, Recipe] => entry[1] !== ABSENT,
      );
      const body = entries.map(([key, value]) => `${JSON.stringify(key)}: ${value.show}`);
      const tail = poisoned === null ? '' : ` poisoned ${JSON.stringify(poisoned)}`;
      return recipe(`${form}{${body.join(', ')}}${tail}`, () =>
        buildObject(form, entries, poisoned),
      );
    });
};

/**
A record is an object of any keys, each under `of`: `objectNear` over a shape of them.
*/
const recordNear = (of: Desc, hostile: boolean): fc.Arbitrary<Recipe> =>
  fc.uniqueArray(fc.constantFrom(...KEYS), { maxLength: MAX_FIELDS }).chain((keys) =>
    objectNear(
      keys.map((key) => [key, of] as const),
      hostile,
    ),
  );

const listNear = (of: Desc, hostile: boolean): fc.Arbitrary<Recipe> =>
  fc
    .tuple(fc.constantFrom(...LIST_FORMS), fc.array(near(of, hostile), { maxLength: MAX_ITEMS }))
    .map(([form, items]) =>
      recipe(`${form}[${items.map((item) => item.show).join(', ')}]`, () =>
        LIST_BUILDERS[form](items.map((item) => item.make())),
      ),
    );

const anything = fc.anything().map((value) => plain(value));
const numbers = fc.oneof(fc.integer(), fc.double(), fc.constantFrom(-0, INT_MAX + 1));

/**
Values the converter maps into its inner schema's domain.
*/
const preimage = (
  desc: Desc & { readonly kind: 'coerce' },
  hostile: boolean,
): fc.Arbitrary<Recipe> => {
  const table: Readonly<Record<Convert, () => fc.Arbitrary<Recipe>>> = {
    constant: () => anything,
    defaultZero: () => fc.constantFrom(UNDEFINED, plain(null)),
    numberFromString: () => numbers.map((value) => plain(String(value))),
    stringFromNumber: () => numbers.map((value) => plain(value)),
    throwsRevoked: () => anything,
    throwsString: () => anything,
    wrapList: () => (desc.of.kind === 'list' ? near(desc.of.of, hostile) : anything),
  };
  return table[desc.convert]();
};

const CONFORMING: Table<fc.Arbitrary<Recipe>, [boolean]> = {
  boolean: () => fc.boolean().map((value) => plain(value)),
  coerce: (desc, hostile) => fc.oneof(near(desc.of, hostile), preimage(desc, hostile)),
  enums: (desc) => fc.constantFrom(...desc.values).map((value) => plain(value)),
  float: () => fc.double({ noDefaultInfinity: true, noNaN: true }).map((value) => plain(value)),
  id: () => fc.string({ maxLength: MAX_TEXT }).map((value) => plain(value)),
  int: () =>
    fc.oneof(fc.integer(), fc.constantFrom(INT_MIN, INT_MAX, -0)).map((value) => plain(value)),
  list: (desc, hostile) => listNear(desc.of, hostile),
  literal: (desc) => fc.constant(plain(desc.value)),
  nullable: (desc, hostile) => fc.oneof(fc.constant(plain(null)), near(desc.of, hostile)),
  object: (desc, hostile) => objectNear(desc.shape, hostile),
  optional: (desc, hostile) => fc.oneof(fc.constant(UNDEFINED), near(desc.of, hostile)),
  record: (desc, hostile) => recordNear(desc.of, hostile),
  refine: (desc, hostile) => near(desc.of, hostile),
  scalar: (desc) =>
    desc.guard === 'Upper'
      ? fc.string({ maxLength: MAX_TEXT }).map((text) => plain(text.toUpperCase()))
      : fc.integer({ max: SMALL_INT, min: -SMALL_INT }).map((value) => plain(value)),
  string: () => fc.string({ maxLength: MAX_TEXT }).map((value) => plain(value)),
  union: (desc, hostile) => fc.oneof(...desc.of.map((member) => near(member, hostile))),
  unknown: () => anything,
};

/**
Values near `desc`: mostly conforming at each level, with typed (and, if `hostile`, throwing) mutations.
*/
const near = (desc: Desc, hostile: boolean): fc.Arbitrary<Recipe> =>
  fc.oneof(
    { arbitrary: dispatch(CONFORMING, desc, hostile), weight: USUALLY },
    { arbitrary: edgeArb(hostile), weight: 1 },
  );

const caseArb = (hostile: boolean): fc.Arbitrary<{ desc: Desc; value: Recipe }> =>
  descArb.chain((desc) => near(desc, hostile).map((value) => ({ desc, value })));

// ─── properties ──────────────────────────────────────────────────────────────────────────────────

const RUNS: fc.Parameters<unknown> = {
  numRuns: 3000,
  ...(Bun.env['FC_SEED'] !== undefined && { seed: Number(Bun.env['FC_SEED']) }),
};

/**
What `fn` threw, or `undefined` if it returned.
*/
const thrown = (thunk: () => unknown): unknown => {
  try {
    thunk();
  } catch (error) {
    return error ?? new Error('threw a nullish value');
  }
  return undefined;
};

const wellFormed = (issues: readonly unknown[]): boolean =>
  issues.length > 0 &&
  issues.every(
    (found) =>
      typeof found === 'object' &&
      found !== null &&
      'message' in found &&
      typeof found.message === 'string' &&
      'path' in found &&
      Array.isArray(found.path),
  );

/**
Every verb's view of an accepted value: no issues, a fresh snapshot mirroring the reference's output, no throw.
*/
const expectAccepted = (
  input: unknown,
  { out, schema }: { out: unknown; schema: Schema },
): void => {
  expect(validate(input, schema).issues).toBeUndefined();
  expect(mirrors(out, parse(input, schema), reachable(input))).toBe(true);
  expect(
    thrown(() => {
      assert(input, schema);
    }),
  ).toBeUndefined();
};

/**
Every verb's view of a rejected value: well-formed issues, VeraxError from the throwing verbs.
*/
const expectRejected = (input: unknown, schema: Schema): void => {
  const { issues } = validate(input, schema);
  expect(issues !== undefined && wellFormed(issues)).toBe(true);
  expect(thrown(() => parse(input, schema))).toBeInstanceOf(VeraxError);
  expect(
    thrown(() => {
      assert(input, schema);
    }),
  ).toBeInstanceOf(VeraxError);
};

/**
`fn` returns, or throws a VeraxError — nothing else escapes.
*/
const expectOnlyVeraxError = (thunk: () => unknown): void => {
  const error = thrown(thunk);
  expect(error === undefined || error instanceof VeraxError).toBe(true);
};

describe('verax agrees with the reference model', () => {
  test('is(v, S) === reference.accepts(desc, v)', () => {
    fc.assert(
      fc.property(caseArb(false), ({ desc, value }) => {
        const input = value.make();
        expect(is(input, compile(desc))).toBe(reference(desc, input).ok);
      }),
      RUNS,
    );
  });

  test('validate reports no issues exactly when is() accepts; ~standard agrees', () => {
    fc.assert(
      fc.property(caseArb(false), ({ desc, value }) => {
        const input = value.make();
        const schema = compile(desc);
        const accepted = is(input, schema);
        expect(validate(input, schema).issues === undefined).toBe(accepted);
        const standard = schema['~standard'].validate(input);
        expect(standard instanceof Promise).toBe(false);
        expect('issues' in standard && standard.issues !== undefined).toBe(!accepted);
      }),
      RUNS,
    );
  });

  test('accepted: parse is a fresh snapshot of the reference output; rejected: well-formed issues, VeraxError', () => {
    fc.assert(
      fc.property(caseArb(false), ({ desc, value }) => {
        const input = value.make();
        const verdict = reference(desc, input);
        if (verdict.ok) {
          expectAccepted(input, { out: verdict.out, schema: compile(desc) });
        } else {
          expectRejected(input, compile(desc));
        }
      }),
      RUNS,
    );
  });
});

describe('hostile input never escapes as a throw', () => {
  test('validate/is/~standard never throw; parse/assert throw only VeraxError; is agrees with the reference', () => {
    fc.assert(
      fc.property(caseArb(true), ({ desc, value }) => {
        const input = value.make();
        const schema = compile(desc);
        expect(thrown(() => validate(input, schema))).toBeUndefined();
        expect(thrown(() => schema['~standard'].validate(input))).toBeUndefined();
        let accepted = false;
        expect(
          thrown(() => {
            accepted = is(input, schema);
          }),
        ).toBeUndefined();
        expect(accepted).toBe(reference(desc, input).ok);
        expectOnlyVeraxError(() => parse(input, schema));
        expectOnlyVeraxError(() => {
          assert(input, schema);
        });
      }),
      RUNS,
    );
  });
});

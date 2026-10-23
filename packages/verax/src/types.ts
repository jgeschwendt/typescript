import {
  type Def,
  FAIL,
  FREE,
  type Fail,
  type Impl,
  type Infer,
  type Input,
  type Primitive,
  type Schema,
  type Shape,
  admit,
  choose,
  closest,
  describe,
  enter,
  forfeit,
  impl,
  issue,
  leave,
  miss,
  overflow,
  pick,
  refund,
  schema,
  spend,
  stray,
  tick,
  unjudged,
} from './core.js';
import type { StandardSchemaV1 } from './standard.js';

// ─── leaves: one predicate decides, and the output is the input ──────────────────────────────────

/**
Each leaf's predicate and the noun its issue names: containers call `test`
directly, skipping `fast`. A pure one runs no callback: not a `scalar`'s.
*/
const leaves = new WeakMap<
  StandardSchemaV1,
  {
    readonly expected: string;
    readonly pure: boolean;
    readonly test: (value: unknown) => boolean;
  }
>();

/**
Each `literal` and its value — a discriminant, if its union's members share its key.
*/
const literals = new WeakMap<StandardSchemaV1, { readonly value: Primitive }>();

const leaf = <TValue>(
  def: Def,
  expected: string,
  test: (value: unknown) => boolean,
  pure = true,
): Schema<TValue> => {
  const made = schema<TValue>(
    def,
    (value) => (test(value) ? (value as TValue) : FAIL),
    (value, context) => {
      if (!test(value)) {
        issue(context, `Expected ${expected}, received ${describe(value)}`);
      }
      return value as TValue;
    },
  );
  leaves.set(made, { expected, pure, test });
  return made;
};

/**
One def per built-in, so `sdl()` can tell `int()` from a user scalar named `Int`.
*/
export const BUILTINS = Object.freeze({
  Boolean: Object.freeze({ kind: 'scalar', name: 'Boolean' }),
  Float: Object.freeze({ kind: 'scalar', name: 'Float' }),
  ID: Object.freeze({ kind: 'scalar', name: 'ID' }),
  Int: Object.freeze({ kind: 'scalar', name: 'Int' }),
  String: Object.freeze({ kind: 'scalar', name: 'String' }),
} as const satisfies Record<string, Def>);

/**
A named leaf type — GraphQL's custom scalar. `test` is the whole contract;
compose `coerce` for parseValue-style conversion.
*/
export const scalar = <TValue>(
  name: string,
  test: (value: unknown) => value is TValue,
): Schema<TValue> => leaf({ kind: 'scalar', name }, name, test, false);

const INT_MAX = 2 ** 31 - 1;
const INT_MIN = -(2 ** 31);
const isString = (value: unknown): boolean => typeof value === 'string';

export const boolean = (): Schema<boolean> =>
  leaf(BUILTINS.Boolean, 'Boolean', (value) => typeof value === 'boolean');

/**
Finite double — GraphQL `Float`.
*/
export const float = (): Schema<number> =>
  leaf(BUILTINS.Float, 'Float', (value) => Number.isFinite(value));

/**
Opaque identifier — GraphQL `ID`, a string here (coerce to accept integers).
*/
export const id = (): Schema<string> => leaf(BUILTINS.ID, 'ID', isString);

/**
Signed 32-bit integer — GraphQL `Int`.
*/
export const int = (): Schema<number> =>
  leaf(
    BUILTINS.Int,
    'Int',
    (value) =>
      typeof value === 'number' && Number.isInteger(value) && value >= INT_MIN && value <= INT_MAX,
  );

export const string = (): Schema<string> => leaf(BUILTINS.String, 'String', isString);

/**
Exactly `value`, by `Object.is` — `literal(NaN)` matches NaN, `literal(0)` rejects -0.
*/
export const literal = <const TValue extends Primitive>(value: TValue): Schema<TValue> => {
  const made = leaf<TValue>({ kind: 'literal', value }, describe(value), (received) =>
    Object.is(received, value),
  );
  literals.set(made, { value });
  return made;
};

export const unknown = (): Schema => leaf({ kind: 'unknown' }, 'unknown', () => true);

// ─── wrappers: non-null is the default, as in GraphQL ────────────────────────────────────────────

/**
Checks items by index, never through the input's own methods or iterator, so holes are checked too. Each item is read once; the output is a fresh array of what was read.
*/
export const list = <TSchema extends StandardSchemaV1>(
  of: TSchema,
): Schema<Infer<TSchema>[], Input<TSchema>[]> => {
  type Out = Infer<TSchema>[];
  const test = leaves.get(of)?.test;
  const { check, fast, run } = impl(of);
  /**
  Admits a list of `length` items, a level down only if items descend; a proxy's `length` can be anything.
  */
  const open = (length: number): string | undefined =>
    Number.isInteger(length) && length >= 0 && length <= 2 ** 32 - 1
      ? (test === undefined ? enter : admit)(length)
      : 'Invalid list length';
  return schema<Out, Input<TSchema>[]>(
    { kind: 'list', of },
    (value) => {
      if (!Array.isArray(value)) {
        return FAIL;
      }
      const items: readonly unknown[] = value;
      const { length } = items;
      if (open(length) !== undefined) {
        return FAIL;
      }
      // Sized up front — growing it is 2–3× slower — so a list that fails
      // forfeits its unread items: they were allocated, if never read.
      const out = new Array<unknown>(length);
      if (test === undefined) {
        for (let index = 0; index < length; index += 1) {
          const each = fast(items[index]);
          if (each === FAIL) {
            return forfeit(length - index);
          }
          out[index] = each;
        }
      } else {
        for (let index = 0; index < length; index += 1) {
          const each = items[index];
          if (!test(each)) {
            return forfeit(length - index);
          }
          out[index] = each;
        }
      }
      if (test === undefined) {
        leave();
      }
      return out;
    },
    (value, context) => {
      if (!Array.isArray(value)) {
        issue(context, `Expected list, received ${describe(value)}`);
        return value as Out;
      }
      const items: readonly unknown[] = value;
      const { length } = items;
      const why = open(length);
      if (why !== undefined) {
        issue(context, why);
        return value as Out;
      }
      const out: unknown[] = [];
      const { path } = context;
      const at = path.push(0) - 1;
      if (test === undefined) {
        for (let index = 0; index < length; index += 1) {
          path[at] = index;
          out.push(run(items[index], context));
        }
      } else {
        let index = 0;
        try {
          for (; index < length; index += 1) {
            const each = items[index];
            if (!test(each)) {
              path[at] = index;
              run(each, context);
            }
            out.push(each);
          }
        } catch (error) {
          // The path is kept current only on faults: a throw sets it here.
          path[at] = index;
          throw error;
        }
      }
      path.pop();
      if (test === undefined) {
        leave();
      }
      return out;
    },
    (value) => {
      if (!Array.isArray(value)) {
        return FAIL;
      }
      const items: readonly unknown[] = value;
      const { length } = items;
      if (open(length) !== undefined) {
        return FAIL;
      }
      if (test === undefined) {
        for (let index = 0; index < length; index += 1) {
          if (check(items[index]) === FAIL) {
            return forfeit(length - index);
          }
        }
      } else {
        for (let index = 0; index < length; index += 1) {
          if (!test(items[index])) {
            return forfeit(length - index);
          }
        }
      }
      if (test === undefined) {
        leave();
      }
      return items;
    },
  );
};

/**
`nullable`/`optional` over a leaf is a leaf: one test, the inner noun.
*/
const wrap = <TOut, TIn>(def: Def, of: StandardSchemaV1, allowed?: null): Schema<TOut, TIn> => {
  const inner = leaves.get(of);
  if (inner !== undefined) {
    const { test } = inner;
    return leaf(
      def,
      inner.expected,
      (value) => value === allowed || test(value),
      inner.pure,
    ) as Schema<TOut, TIn>;
  }
  const { check, fast, run } = impl(of);
  return schema(
    def,
    (value) => (value === allowed ? allowed : fast(value)) as Fail | TOut,
    (value, context) => (value === allowed ? allowed : run(value, context)) as TOut,
    (value) => (value === allowed ? allowed : check(value)),
  );
};

export const nullable = <TSchema extends StandardSchemaV1>(
  of: TSchema,
): Schema<Infer<TSchema> | null, Input<TSchema> | null> => wrap({ kind: 'nullable', of }, of, null);

export interface Optional<TOut, TIn = TOut> extends Schema<TOut | undefined, TIn | undefined> {
  readonly def: Extract<Def, { kind: 'optional' }>;
}

/**
The key may be absent (or `undefined`). Distinct from `nullable`.
*/
export const optional = <TSchema extends StandardSchemaV1>(
  of: TSchema,
): Optional<Infer<TSchema>, Input<TSchema>> =>
  wrap({ kind: 'optional', of }, of) as Optional<Infer<TSchema>, Input<TSchema>>;

// ─── named composites ────────────────────────────────────────────────────────────────────────────

/**
Splits `(body)` or `(name, body)`; the name reaches the def only when given.
*/
const split = <TBody>(
  parts: readonly [TBody] | readonly [string, TBody],
): [{ readonly name?: string }, TBody] =>
  parts.length === 1 ? [{}, parts[0]] : [{ name: parts[0] }, parts[1]];

type Side<TSchema extends StandardSchemaV1, TSide extends 'input' | 'output'> = NonNullable<
  TSchema['~standard']['types']
>[TSide];

/**
The object type a shape describes; `TSide` picks the input or output side.
A key is optional exactly when its side admits `undefined`: an absent key is
validated as `undefined`, and stays absent in the output when that is what
its schema produced.
*/
export type ObjectOf<TShape extends Shape, TSide extends 'input' | 'output' = 'output'> = {
  -readonly [
    TKey in keyof TShape & string as undefined extends Side<TShape[TKey], TSide> ? never : TKey
  ]: Side<TShape[TKey], TSide>;
} & {
  -readonly [
    TKey in keyof TShape & string as undefined extends Side<TShape[TKey], TSide> ? TKey : never
  ]?: Side<TShape[TKey], TSide>;
} extends infer TObject
  ? { [TKey in keyof TObject]: TObject[TKey] }
  : never;

/**
When a field is checked, under any nullable/optional wrapping: an enum or
literal — a discriminant — 2, another leaf (a scalar) 1, anything else 0.
A def from elsewhere may be missing.
*/
const rank = ({ def }: Partial<Schema>): number =>
  def?.kind === 'nullable' || def?.kind === 'optional'
    ? rank(def.of)
    : def?.kind === 'enum' || def?.kind === 'literal'
      ? 2
      : def?.kind === 'scalar'
        ? 1
        : 0;

interface Field extends Impl {
  /**
  Position in the shape, where its output goes.
  */
  readonly at: number;
  /**
  Assignment would hit an `Object.prototype` accessor (`__proto__`) or a frozen intrinsic.
  */
  readonly define: boolean;
  readonly key: string;
  /**
  Its `rank`: leaf fields are checked first, discriminants first of all in a wide shape.
  */
  readonly rank: number;
  /**
  A leaf's predicate, called in place of its checks.
  */
  readonly test: ((value: unknown) => boolean) | undefined;
}

/**
The shape, read once: getters run on first use, never per validation.
*/
interface Plan {
  /**
  In shape order — outputs and issues follow it.
  */
  readonly fields: readonly Field[];
  /**
  How many leaf fields lead `order`: checked before the object is admitted, a failing one wastes nothing.
  */
  readonly lead: number;
  /**
  Some field is not a leaf: the walk descends, so the object counts as a level.
  */
  readonly nested: boolean;
  /**
  Leaf fields first, by rank: a failing discriminant skips the nested fields.
  */
  readonly order: readonly Field[];
  /**
  `order` is not shape order, so an output is assembled after the walk.
  */
  readonly reordered: boolean;
  /**
  Frozen, null-prototype: `def.shape`, and the known-key lookup.
  */
  readonly shape: Shape;
}

// ※ verax-hot-path
// Shapes resolve here, once: the per-run walks index these plans and never call
// Object.entries/keys or iterator helpers (measured: 2–11× slower).
const read = (shape: Shape): Plan => {
  const record = Object.create(null) as Record<string, StandardSchemaV1>;
  const fields = Object.entries(shape).map(([key, field], at): Field => {
    record[key] = field;
    return {
      ...impl(field),
      at,
      define: key in Object.prototype,
      key,
      rank: rank(field),
      test: leaves.get(field)?.test,
    };
  });
  const lead = fields.filter((field) => field.rank > 0).length;
  // A walk reads `FREE` leaf fields free before one fails: past that many, discriminants go first.
  const key = (field: Field): number => (lead > FREE ? field.rank : Math.sign(field.rank));
  const order = fields.toSorted((left, right) => key(right) - key(left));
  return {
    fields,
    lead,
    nested: fields.some((field) => field.test === undefined),
    order,
    reordered: order.some((field, at) => field !== fields[at]),
    shape: Object.freeze(record),
  };
};

/**
Writes an output entry; `define` — a key `Object.prototype` holds — keeps a
`__proto__` key a key.
*/
const put = (
  out: Record<string, unknown>,
  key: string,
  value: unknown,
  define = key in Object.prototype,
): void => {
  if (define) {
    Object.defineProperty(out, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  } else {
    out[key] = value;
  }
};

/**
Plain data only: `{}` or `Object.create(null)` of this realm — not arrays,
dates, class instances, or objects beneath another, whose keys `for…in`
would walk.
*/
const isPlain = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
Whether an own key is unknown. Every key the shape lacks is work, own or inherited — enumerating them costs the same — so all are counted, not just the first: a shared object with many keys cannot cost more than it counts.
*/
const strays = (value: Record<string, unknown>, known: Shape): boolean => {
  let count = 0;
  let own = false;
  for (const key in value) {
    if (known[key] !== undefined) {
      continue;
    }
    count += 1;
    own ||= Object.hasOwn(value, key);
  }
  spend(count);
  return own;
};

/**
Admits an object whose leading leaf fields passed — unless it has an unknown key — counting its whole weight: a discriminant fails before this.
*/
const gate = (value: Record<string, unknown>, plan: Plan): boolean =>
  !strays(value, plan.shape) && (plan.nested ? enter : admit)(plan.order.length) === undefined;

/**
A field's output, or `FAIL`: a leaf field's output is what was read.
*/
const through = ({ fast, test }: Field, each: unknown): unknown =>
  test === undefined ? fast(each) : test(each) ? each : FAIL;

/**
Output keys follow the shape; a key is kept when present, or when its schema produced a value.
*/
const assemble = (fields: readonly Field[], outs: readonly unknown[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const got = outs[field.at];
    if (got !== FAIL) {
      put(out, field.key, got, field.define);
    }
  }
  return out;
};

/**
Walks `order` — the plan's, or the rest of it once a union read its
discriminant into `outs` — whose first `lead` fields are leaves.
*/
const walk = (
  value: Record<string, unknown>,
  plan: Plan,
  order: readonly Field[],
  lead: number,
  outs: unknown[],
): unknown => {
  const { length } = order;
  for (let index = 0; index < length; index += 1) {
    if (index === lead && !gate(value, plan)) {
      return FAIL;
    }
    const field = order[index] as Field;
    const has = Object.hasOwn(value, field.key);
    const got = through(field, has ? value[field.key] : undefined);
    if (got === FAIL) {
      return index < lead ? miss(index) : refund(length - index);
    }
    outs[field.at] = has || got !== undefined ? got : FAIL;
  }
  if (lead === length && !gate(value, plan)) {
    return FAIL;
  }
  if (plan.nested) {
    leave();
  }
  return assemble(plan.fields, outs);
};

/**
`walk` for `is`: the verdict alone.
*/
const scan = (
  value: Record<string, unknown>,
  plan: Plan,
  order: readonly Field[],
  lead: number,
): unknown => {
  const { length } = order;
  for (let index = 0; index < length; index += 1) {
    if (index === lead && !gate(value, plan)) {
      return FAIL;
    }
    const { check, key, test } = order[index] as Field;
    const each = Object.hasOwn(value, key) ? value[key] : undefined;
    if (test === undefined ? check(each) === FAIL : !test(each)) {
      return index < lead ? miss(index) : refund(length - index);
    }
  }
  if (lead === length && !gate(value, plan)) {
    return FAIL;
  }
  if (plan.nested) {
    leave();
  }
  return value;
};

/**
Each object schema's plan, by its checks: a union reads its members' plans.
*/
const plans = new WeakMap<Impl, () => Plan>();

/**
Objects, and refines of them: checks that see the value as given, so a tag read from it names them.
*/
const raw = new WeakSet<Impl>();

/**
Exact plain object — unknown keys are issues, like a GraphQL input object.
Only own keys count, each read once; an absent key is validated as
`undefined`, and kept in the output only if its schema produced a value (a
coerced default). The output is a fresh plain object, in shape key order.
*/
export function object<TShape extends Shape>(
  shape: TShape,
): Schema<ObjectOf<TShape>, ObjectOf<TShape, 'input'>>;
export function object<TShape extends Shape>(
  name: string,
  shape: TShape,
): Schema<ObjectOf<TShape>, ObjectOf<TShape, 'input'>>;
export function object<TShape extends Shape>(
  ...parts: readonly [TShape] | readonly [string, TShape]
): Schema<ObjectOf<TShape>, ObjectOf<TShape, 'input'>> {
  type Out = ObjectOf<TShape>;
  const [naming, shape] = split(parts);
  const label = naming.name ?? 'object';
  let plan: Plan | undefined;
  const resolve = (): Plan => (plan ??= read(shape));
  const made = schema<Out, ObjectOf<TShape, 'input'>>(
    {
      kind: 'object',
      ...naming,
      get shape(): Shape {
        return resolve().shape;
      },
    },
    (value) => {
      if (!isPlain(value)) {
        return FAIL;
      }
      const resolved = plan ?? resolve();
      const { fields, lead, nested, order, reordered } = resolved;
      if (reordered) {
        return walk(value, resolved, order, lead, []) as Fail | Out;
      }
      const { length } = fields;
      const out: Record<string, unknown> = {};
      for (let index = 0; index < length; index += 1) {
        if (index === lead && !gate(value, resolved)) {
          return FAIL;
        }
        const field = fields[index] as Field;
        const has = Object.hasOwn(value, field.key);
        const got = through(field, has ? value[field.key] : undefined);
        if (got === FAIL) {
          return index < lead ? miss(index) : refund(length - index);
        }
        if (has || got !== undefined) {
          put(out, field.key, got, field.define);
        }
      }
      if (lead === length && !gate(value, resolved)) {
        return FAIL;
      }
      if (nested) {
        leave();
      }
      return out as Out;
    },
    (value, context) => {
      if (!isPlain(value)) {
        issue(context, `Expected ${label}, received ${describe(value)}`);
        return value as Out;
      }
      const { fields, nested, shape: known } = plan ?? resolve();
      const why = (nested ? enter : admit)(fields.length);
      if (why !== undefined) {
        issue(context, why);
        return value as Out;
      }
      const out: Record<string, unknown> = {};
      const { path } = context;
      const at = path.push('') - 1;
      for (const field of fields) {
        path[at] = field.key;
        const has = Object.hasOwn(value, field.key);
        const each = has ? value[field.key] : undefined;
        // A leaf that passes needs no full check.
        const got = field.test !== undefined && field.test(each) ? each : field.run(each, context);
        if (has || got !== undefined) {
          put(out, field.key, got, field.define);
        }
      }
      path.pop();
      if (strays(value, known)) {
        for (const key in value) {
          if (known[key] === undefined && Object.hasOwn(value, key)) {
            stray(context, key, `Unknown field on ${label}`);
          }
        }
      }
      if (nested) {
        leave();
      }
      return out as Out;
    },
    (value) => {
      if (!isPlain(value)) {
        return FAIL;
      }
      const resolved = plan ?? resolve();
      return scan(value, resolved, resolved.order, resolved.lead);
    },
  );
  plans.set(impl(made), resolve);
  raw.add(impl(made));
  return made;
}

/**
The keys a record walk stopped short of, after `seen`: `for…in` lists every
key up front, so the rest are work all the same — never waste.
*/
const rest = (value: object, seen: number): Fail => {
  let total = 0;
  for (const _key in value) {
    total += 1;
  }
  return total > seen ? spend(total - seen) : FAIL;
};

/**
`rest`, on the way out of a throw: the throw stands, whatever counting it meets.
*/
const unwind = (value: object, seen: number): void => {
  try {
    rest(value, seen);
  } catch {
    // A hostile key list, or the stack's edge: the original throw stands.
  }
};

/**
A plain object of any string keys, each own enumerable one's value checked
against `of` — `Record<string, V>`. Keys are enumerated with `for…in`, each
value read once; the output is a fresh plain object of what was read, in the
input's key order. A record of n keys is n + 1 steps.
*/
export const record = <TSchema extends StandardSchemaV1>(
  of: TSchema,
): Schema<Record<string, Infer<TSchema>>, Record<string, Input<TSchema>>> => {
  type Out = Record<string, Infer<TSchema>>;
  const test = leaves.get(of)?.test;
  const { check, fast, run } = impl(of);
  /**
  Admits the record, a level down only if its values descend; each key is counted as it is read.
  */
  const open = test === undefined ? enter : admit;
  /**
  A walk failing on its `seen`-th key: the rest count, never as waste; and
  a leaf value's failure, like an object's leaf field, wastes nothing.
  */
  const fail = (value: object, seen: number): Fail => {
    if (test !== undefined) {
      refund(seen + 1);
      miss(seen - 1);
    }
    return rest(value, seen);
  };
  return schema<Out, Record<string, Input<TSchema>>>(
    { kind: 'record', of },
    (value) => {
      if (!isPlain(value) || open(0) !== undefined) {
        return FAIL;
      }
      const out: Record<string, unknown> = {};
      let seen = 0;
      try {
        for (const key in value) {
          seen += 1;
          if (tick() !== undefined) {
            return FAIL;
          }
          if (!Object.hasOwn(value, key)) {
            continue;
          }
          const each = value[key];
          const got = test === undefined ? fast(each) : test(each) ? each : FAIL;
          if (got === FAIL) {
            return fail(value, seen);
          }
          put(out, key, got);
        }
      } catch (error) {
        unwind(value, seen);
        throw error;
      }
      if (test === undefined) {
        leave();
      }
      return out;
    },
    (value, context) => {
      if (!isPlain(value)) {
        issue(context, `Expected record, received ${describe(value)}`);
        return value as Out;
      }
      const why = open(0);
      if (why !== undefined) {
        issue(context, why);
        return value;
      }
      const out: Record<string, unknown> = {};
      const { path } = context;
      // Extended by the first key: a key list that throws is the record's own issue.
      const at = path.length;
      let seen = 0;
      try {
        for (const key in value) {
          seen += 1;
          path[at] = key;
          const refused = tick();
          if (refused !== undefined) {
            path.length = at;
            issue(context, refused);
          }
          if (!Object.hasOwn(value, key)) {
            continue;
          }
          const each = value[key];
          // A leaf that passes needs no full check.
          put(out, key, test !== undefined && test(each) ? each : run(each, context));
        }
      } catch (error) {
        unwind(value, seen);
        throw error;
      }
      path.length = at;
      if (test === undefined) {
        leave();
      }
      return out;
    },
    (value) => {
      if (!isPlain(value) || open(0) !== undefined) {
        return FAIL;
      }
      let seen = 0;
      try {
        for (const key in value) {
          seen += 1;
          if (tick() !== undefined) {
            return FAIL;
          }
          if (
            Object.hasOwn(value, key) &&
            (test === undefined ? check(value[key]) === FAIL : !test(value[key]))
          ) {
            return fail(value, seen);
          }
        }
      } catch (error) {
        unwind(value, seen);
        throw error;
      }
      if (test === undefined) {
        leave();
      }
      return value;
    },
  );
};

export function enums<const TValues extends readonly string[]>(
  values: TValues,
): Schema<TValues[number]>;
export function enums<const TValues extends readonly string[]>(
  name: string,
  values: TValues,
): Schema<TValues[number]>;
export function enums<const TValues extends readonly string[]>(
  ...parts: readonly [TValues] | readonly [string, TValues]
): Schema<TValues[number]> {
  const [naming, given] = split(parts);
  // A frozen copy: a later change to the caller's array reaches neither the check nor the def.
  const values = Object.freeze([...given]);
  return leaf(
    { kind: 'enum', ...naming, values },
    `${naming.name === undefined ? 'one of' : `${naming.name}:`} ${values.join(' | ')}`,
    (value) => typeof value === 'string' && values.includes(value),
  );
}

/**
A union's members, as `pick` tries them.
*/
interface Members {
  readonly check: readonly ((value: unknown) => unknown)[];
  readonly fast: readonly ((value: unknown) => unknown)[];
}

/**
A member found by its discriminant: the rest of its walk, the discriminant read.
*/
interface Found {
  /**
  The discriminant's position in the shape, where its output goes.
  */
  readonly at: number;
  readonly lead: number;
  readonly order: readonly Field[];
  readonly plan: Plan;
  readonly value: Primitive;
}

/**
The members by their literal at `key`, or `undefined`: each must hold one,
distinct — `Map` keys, so 0 and -0 collide — read after only pure leaf
fields, so a member it rejects runs no callback before rejecting.
*/
const tabulate = (members: readonly Plan[], key: string): Map<unknown, Found> | undefined => {
  const table = new Map<unknown, Found>();
  for (const plan of members) {
    const { lead, order, shape } = plan;
    const index = order.findIndex((field) => field.key === key);
    const tag = literals.get(shape[key] as StandardSchemaV1);
    if (
      index === -1 ||
      tag === undefined ||
      // An undefined discriminant can't tell absent from present: tried in turn.
      tag.value === undefined ||
      table.has(tag.value) ||
      order
        .slice(0, index)
        .some((field) => leaves.get(shape[field.key] as StandardSchemaV1)?.pure !== true)
    ) {
      return undefined;
    }
    table.set(tag.value, {
      at: (order[index] as Field).at,
      lead: lead - 1,
      order: order.toSpliced(index, 1),
      plan,
      value: tag.value,
    });
  }
  return table;
};

/**
Members found by one read, when every member is an object of this copy and
all share a discriminant: the first leaf field of the first member that
`tabulate` accepts. A value is then one read and a lookup — the verdict of
trying each in order, as every other member fails at the discriminant, but
at one step per value, whatever the width. Reads every member's shape.
*/
const discriminate = (members: readonly Impl[]): Members | undefined => {
  const resolvers: (() => Plan)[] = [];
  for (const member of members) {
    const resolve = plans.get(member);
    if (resolve === undefined) {
      return undefined;
    }
    resolvers.push(resolve);
  }
  const resolved = resolvers.map((resolve) => resolve());
  const first = resolved[0];
  if (first === undefined) {
    return undefined;
  }
  for (const { key } of first.order.slice(0, first.lead)) {
    const table = tabulate(resolved, key);
    if (table !== undefined) {
      /**
      The member the discriminant names, if it holds that very value (`Map` finds -0 at 0).
      */
      const find = (value: Record<string, unknown>): Found | undefined => {
        const seen = Object.hasOwn(value, key) ? value[key] : undefined;
        const found = table.get(seen);
        return found !== undefined && Object.is(seen, found.value) ? found : undefined;
      };
      return {
        check: [
          (value) => {
            const found = isPlain(value) ? find(value) : undefined;
            return found === undefined
              ? FAIL
              : scan(value as Record<string, unknown>, found.plan, found.order, found.lead);
          },
        ],
        fast: [
          (value) => {
            const found = isPlain(value) ? find(value) : undefined;
            if (found === undefined) {
              return FAIL;
            }
            const outs: unknown[] = [];
            outs[found.at] = found.value;
            return walk(
              value as Record<string, unknown>,
              found.plan,
              found.order,
              found.lead,
              outs,
            );
          },
        ],
      };
    }
  }
  return undefined;
};

/**
How a failed union explains itself. When every member is an `object` of
this copy — refined too, never coerced — holding a distinct literal at one key, by the
member the value's key names, else that key's accepted values; otherwise
by the closest member.
*/
const tell = (of: readonly StandardSchemaV1[], own: readonly Impl[]): Impl['run'] => {
  const runs = own.map(({ run }) => run);
  const shapes = of.map(({ def }: Partial<Schema>, at) =>
    raw.has(own[at] as Impl) && def?.kind === 'object' ? def.shape : {},
  );
  for (const key in shapes[0]) {
    const table = new Map<unknown, readonly [Primitive, Impl['run']]>();
    for (const [index, shape] of shapes.entries()) {
      const tag = literals.get(shape[key] as StandardSchemaV1);
      if (tag !== undefined && !table.has(tag.value)) {
        table.set(tag.value, [tag.value, runs[index] as Impl['run']]);
      }
    }
    if (table.size === shapes.length) {
      const expected = Array.from(table.values(), ([tag]) => describe(tag)).join(' | ');
      return (value, context) => {
        if (!isPlain(value)) {
          return;
        }
        const seen = Object.hasOwn(value, key) ? value[key] : undefined;
        const [tag, run] = table.get(seen) ?? [];
        if (run !== undefined && Object.is(seen, tag)) {
          run(value, context);
        } else {
          issue(context, `Expected ${expected}, received ${describe(seen)}`, [
            ...context.path,
            key,
          ]);
        }
      };
    }
  }
  // A leaf fails at the value itself: never the closest.
  return closest(runs.filter((_run, at) => !leaves.has(of[at] as StandardSchemaV1)));
};

type UnionOf<TMembers extends readonly StandardSchemaV1[]> = Schema<
  Infer<TMembers[number]>,
  Input<TMembers[number]>
>;

/**
Tries members in order; the first to accept wins and its output is the
output. Each try is a fast check, which stops at the first failure and
decides leaf fields (enum, literal, scalar) before nested ones — so a
discriminant field makes recursive unions linear regardless of key order.
A member that throws is a member that failed — but stack exhaustion fails the whole check.
*/
export function union<const TMembers extends readonly StandardSchemaV1[]>(
  of: TMembers,
): UnionOf<TMembers>;
export function union<const TMembers extends readonly StandardSchemaV1[]>(
  name: string,
  of: TMembers,
): UnionOf<TMembers>;
export function union<const TMembers extends readonly StandardSchemaV1[]>(
  ...parts: readonly [TMembers] | readonly [string, TMembers]
): UnionOf<TMembers> {
  const [naming, of] = split(parts);
  const label = naming.name ?? 'union member';
  const own = of.map((member) => impl(member));
  const sequential: Members = {
    check: own.map(({ check }) => check),
    fast: own.map(({ fast }) => fast),
  };
  let members: Members | undefined;
  /**
  Found on first use, when every shape can be read; a shape that throws is
  its member's failure, so until then each is tried — but stack exhaustion
  is never a failure, here as in `pick`.
  */
  const settle = (): Members => {
    try {
      members = discriminate(own) ?? sequential;
      return members;
    } catch (error) {
      if (overflow(error)) {
        throw error;
      }
      return sequential;
    }
  };
  let told: Impl['run'] | undefined;
  /**
  Built on first failure, inside its try: a shape that throws is an issue.
  */
  const report: Impl['run'] = (value, context) => {
    (told ??= tell(of, own))(value, context);
  };
  return schema<Infer<TMembers[number]>, Input<TMembers[number]>>(
    { kind: 'union', ...naming, of },
    (value) => pick((members ?? settle()).fast, value),
    (value, context) => choose((members ?? settle()).fast, report, value, context, label),
    (value) => pick((members ?? settle()).check, value),
  );
}

// ※ verax-def-identity
// ─── refine and coerce keep the def — sdl() sees through them ────────────────────────────────────

/**
Narrows accepted values without changing the type. Skipped once the inner schema fails.
*/
export const refine = <TSchema extends Schema>(
  of: TSchema,
  message: string,
  test: (value: Infer<TSchema>) => boolean,
): TSchema => {
  const inner = impl(of);
  const { fast, run } = inner;
  const made = schema(
    of.def,
    // `test` judges the output, so `is` builds it too: fast is the check.
    (value) => {
      const out = fast(value);
      return out === FAIL || !test(out) ? FAIL : out;
    },
    (value, context) => {
      const before = context.issues.length;
      const taken = unjudged();
      const out = run(value, context) as Infer<TSchema>;
      if (context.issues.length === before && unjudged() === taken && !test(out)) {
        issue(context, message);
      }
      return out;
    },
  ) as TSchema;
  if (raw.has(inner)) {
    raw.add(impl(made));
  }
  return made;
};

/**
Converts input before validating — GraphQL's parseValue. The input side becomes `unknown`.
*/
export const coerce = <TSchema extends Schema>(
  of: TSchema,
  convert: (value: unknown) => unknown,
): Pick<TSchema, 'def'> & Schema<Infer<TSchema>, unknown> => {
  const { check, fast, run } = impl(of);
  return schema(
    of.def,
    (value) => fast(convert(value)) as Fail | Infer<TSchema>,
    (value, context) => run(convert(value), context) as Infer<TSchema>,
    (value) => check(convert(value)),
  );
};

import type { StandardSchemaV1 } from './standard.js';

export type Issue = StandardSchemaV1.Issue &
  Readonly<{
    path: readonly PropertyKey[];
  }>;

/**
Structural description of a schema — what `sdl()` and tooling walk. A child
may be a Standard Schema from elsewhere, which has no `def`.
*/
export type Def =
  | Readonly<{
      kind: 'enum';
      name?: string;
      values: readonly string[];
    }>
  | Readonly<{ kind: 'list'; of: StandardSchemaV1 }>
  | Readonly<{ kind: 'literal'; value: Primitive }>
  | Readonly<{ kind: 'nullable'; of: StandardSchemaV1 }>
  | Readonly<{ kind: 'object'; name?: string; shape: Shape }>
  | Readonly<{ kind: 'optional'; of: StandardSchemaV1 }>
  | Readonly<{ kind: 'record'; of: StandardSchemaV1 }>
  | Readonly<{ kind: 'scalar'; name: string }>
  | Readonly<{
      kind: 'union';
      name?: string;
      of: readonly StandardSchemaV1[];
    }>
  | Readonly<{ kind: 'unknown' }>;

export type Primitive = bigint | boolean | number | string | null | undefined;

/**
`TOut` is the output; `TIn` is what the schema accepts — they differ once `coerce` is involved.
*/
export type Schema<TOut = unknown, TIn = TOut> = Readonly<{
  def: Def;
}> &
  StandardSchemaV1<TIn, TOut>;

export type Shape = Readonly<Record<string, StandardSchemaV1>>;

/**
The output type of a schema.
*/
export type Infer<TSchema extends StandardSchemaV1> = StandardSchemaV1.InferOutput<TSchema>;

/**
The input type of a schema — what `is` and `assert` narrow to.
*/
export type Input<TSchema extends StandardSchemaV1> = StandardSchemaV1.InferInput<TSchema>;

/**
Rejection from a fast check. Module-private: no input can be it.
*/
export const FAIL: unique symbol = Symbol('verax.fail');
export type Fail = typeof FAIL;

export type Context = Readonly<{
  /**
  Issues collected before the walk stops: `MAX_ISSUES` unless set.
  */
  cap?: number;
  issues: Issue[];
  path: PropertyKey[];
}>;

/**
A schema's checks, private to this copy of verax. Any may throw.
*/
export type Impl<TOut = unknown> = Readonly<{
  /**
  The verdict alone, for `is`: `FAIL`, or anything else.
  */
  check: (value: unknown) => unknown;
  fast: (value: unknown) => Fail | TOut;
  /**
  Pushes every issue at its path; runs only after `fast` failed.
  */
  run: (value: unknown, context: Context) => TOut;
}>;

// ─── issues ──────────────────────────────────────────────────────────────────────────────────────

const MAX_ISSUES = 100;
const TOO_COMPLEX = 'Too complex';
/**
Thrown to end a full check early; caught only by `verify`.
*/
const STOP: unique symbol = Symbol('verax.stop');

const note = (
  context: Context,
  message: string,
  path: readonly PropertyKey[] = [...context.path],
): void => {
  context.issues.push({ message, path });
};

export const issue = (context: Context, message: string, path?: readonly PropertyKey[]): void => {
  // Past the budget every refusal is its doing, whatever it looks like.
  const why = limit === 0 ? TOO_COMPLEX : message;
  note(context, why, path);
  if (why === TOO_COMPLEX || context.issues.length >= (context.cap ?? MAX_ISSUES)) {
    throw STOP;
  }
};

// ─── the containers being walked ─────────────────────────────────────────────────────────────────

const MAX_DEPTH = 512;
/**
Work allowed in one call, useful or wasted: a DAG walked per path, or callbacks that re-validate, stop here.
*/
const MAX_STEPS = 10_000_000;
/**
Waste allowed free of the useful work beside it, and per unit of it.
*/
const MAX_WASTE = 1_000_000;
const RATIO = 16;
/**
Work a failed stretch may do free, so a discriminant failing a level down costs nothing; and leaf fields a walk may read free before one fails.
*/
export const FREE = 8;

/**
Containers on the path. A validation nested in a callback continues its caller's depth, so no nesting of calls outruns the engine stack. A cycle is walked like any other value: only where the schema follows it, to this limit.
*/
let top = 0;
let frames = 0;
/**
Entry is refused at this depth: `MAX_DEPTH`, or 0 once the call is too complex.
*/
let limit = MAX_DEPTH;
/**
Work done in this call — containers entered, fields and items read: a difference measures a stretch.
*/
let steps = 0;
let waste = 0;
/**
Work that is never waste — keys enumerated that no field reads, leaf fields read before one failed — as it cannot compound: it counts only to the cap.
*/
let linear = 0;
/**
Depth refusals in this call: a union that fails across one reports it.
*/
let deep = 0;
/**
A nested frame met stack exhaustion. Its verdict depended on the caller's stack, and a callback may invert it — so, like the budget, it ends the call.
*/
let exhausted = false;
/**
An explanation ran past the budget: it was undone, and no other runs in this call.
*/
let drained = false;

/**
Charges a failed stretch — a union member, a nested frame's fast check —
that began at `start` with `before` wasted. Its steps include every failure
inside it, so none is charged twice. Retries that compound (an
undiscriminated recursive union) outgrow the useful work beside them; then
every entry is refused and the call ends `Too complex`.
*/
const charge = (start: number, before: number): void => {
  const spent = steps - start - FREE;
  if (spent <= 0) {
    return;
  }
  waste = before + spent;
  if (waste > MAX_WASTE + RATIO * (steps - waste)) {
    limit = 0;
  }
};

/**
Admits a container `weight` fields or items wide, or says why not — too
complex or too deep. Its work is counted up front, so a throw cannot hide
it; a walk that fails refunds the rest.
*/
export const admit = (weight: number): string | undefined => {
  if (top >= limit) {
    if (limit === 0) {
      return TOO_COMPLEX;
    }
    deep += 1;
    return 'Too deep';
  }
  steps += weight + 1;
  if (steps + linear > MAX_STEPS) {
    limit = 0;
    return TOO_COMPLEX;
  }
  return undefined;
};

/**
Admits a container a level down, for walks that descend: its children are one deeper.
*/
export const enter = (weight: number): string | undefined => {
  const why = admit(weight);
  if (why === undefined) {
    top += 1;
  }
  return why;
};

/**
One more key a walk counts as it enumerates — a record's — or why not: too complex.
*/
export const tick = (): string | undefined => {
  steps += 1;
  if (steps + linear > MAX_STEPS) {
    limit = 0;
    return TOO_COMPLEX;
  }
  return undefined;
};

/**
A walk failing with `rest` of its weight unread.
*/
export const refund = (rest: number): Fail => {
  steps -= rest;
  return FAIL;
};

/**
A list failing with `rest` items unread: its output was sized for them, so
they stay work, but never waste. `is` counts them alike, for one verdict.
*/
export const forfeit = (rest: number): Fail => {
  steps -= rest;
  return spend(rest);
};

/**
A walk failing on its leaf field `index`: those read before it are never waste, and the first `FREE` are free.
*/
export const miss = (index: number): Fail => (index > FREE ? spend(index - FREE) : FAIL);

/**
A walk counting `work` that is never waste; it fails, if it stops here.
*/
export const spend = (work: number): Fail => {
  linear += work;
  if (steps + linear > MAX_STEPS) {
    limit = 0;
  }
  return FAIL;
};

export const leave = (): void => {
  top -= 1;
};

/**
Containers on the path: 0 between top-level calls.
*/
export const depth = (): number => top;

/**
Opens a frame; a top-level frame starts afresh.
*/
const open = (): void => {
  if (frames === 0) {
    limit = MAX_DEPTH;
    steps = 0;
    waste = 0;
    linear = 0;
    deep = 0;
    exhausted = false;
    drained = false;
  }
  frames += 1;
};

/**
Closes a frame opened at depth `from`, however its walk ended.
*/
const close = (from: number): void => {
  top = from;
  frames -= 1;
};

// ─── describing values in messages ───────────────────────────────────────────────────────────────

const MAX_STRING = 40;
/**
Printable ASCII but `"` and `\\`: quoting alone matches `JSON.stringify`, at a fraction of its cost.
*/
const PLAIN = /^[ !#-[\]-~]*$/u;
const IDENTIFIER = /^[$A-Z_a-z][\w$]{0,39}$/u;

const render = (value: unknown): string => {
  switch (typeof value) {
    case 'bigint': {
      return `${value}n`;
    }
    case 'boolean':
    case 'number':
    case 'symbol':
    case 'undefined': {
      return Object.is(value, -0) ? '-0' : String(value);
    }
    case 'function': {
      return 'function';
    }
    case 'object': {
      break;
    }
    case 'string': {
      const text = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
      return PLAIN.test(text) ? `"${text}"` : JSON.stringify(text);
    }
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'list';
  }
  // A class instance by its constructor's name, if it is a short identifier: `Date`, not `object`.
  const name: unknown = (
    Object.getPrototypeOf(value) as {
      constructor?: { name?: unknown };
    } | null
  )?.constructor?.name;
  return typeof name === 'string' && name !== 'Object' && IDENTIFIER.test(name) ? name : 'object';
};

/**
A short, never-throwing rendering of a received value (a revoked Proxy throws from `Array.isArray`).
*/
export const describe = (value: unknown): string => {
  try {
    return render(value);
  } catch {
    return 'value';
  }
};

/**
A thrown value's message; the value, and its message, may be hostile.
*/
const explain = (error: unknown): string => {
  try {
    if (error instanceof Error) {
      const { message } = error as { message: unknown };
      return typeof message === 'string' ? message : describe(message);
    }
  } catch {
    // A throwing `message` getter or prototype trap.
  }
  return describe(error);
};

// ─── unions ──────────────────────────────────────────────────────────────────────────────────────

const OVERFLOW = /call stack/iu;

/**
Stack exhaustion is never a failed member: swallowing it would make the
verdict depend on the caller's stack. Any other `RangeError` is a failure.
*/
export const overflow = (error: unknown): boolean => {
  try {
    if (!(error instanceof RangeError)) {
      return false;
    }
  } catch {
    // A hostile value's prototype trap: a failed member.
    return false;
  }
  try {
    const { message } = error as { message: unknown };
    return typeof message === 'string' && OVERFLOW.test(message);
  } catch {
    // At the stack's edge the test itself can overflow: fail closed.
    return true;
  }
};

/**
The first member's output to accept, or `FAIL`. A member that throws failed.
*/
export const pick = (
  members: readonly ((value: unknown) => unknown)[],
  value: unknown,
): unknown => {
  const from = top;
  for (const member of members) {
    const start = steps;
    const before = waste;
    let out: unknown = FAIL;
    try {
      out = member(value);
    } catch (error) {
      if (overflow(error)) {
        throw error;
      }
    }
    if (out !== FAIL) {
      return out;
    }
    // Unwinds what the member left entered.
    top = from;
    charge(start, before);
    // Every attempt is work, however early it failed: a wide union costs its width.
    spend(1);
    // Past the budget no member can be judged.
    if (limit === 0) {
      break;
    }
  }
  return FAIL;
};

/**
An untagged union is explaining itself: one nested in its explanation reports only its mismatch.
*/
let explaining = false;
/**
The path length of the value whose union is trying a member's full check, or -1: a union nested in the try is taken to pass, unjudged, so tries never compound.
*/
let comparing = -1;
/**
Unions taken to pass so far: an output holding one is unjudged, so no `refine` may test it.
*/
let taken = 0;

export const unjudged = (): number => taken;
/**
Keys a member being tried did not know, on the value its union compares members on.
*/
let strangers = 0;

/**
Reports an unknown key; one of the value a union compares members on means the member is not it.
*/
export const stray = (context: Context, key: string, message: string): void => {
  strangers += frames === 1 && context.path.length === comparing ? 1 : 0;
  issue(context, message, [...context.path, key]);
};

/**
The issues `run` finds in `value` at `path`, up to `cap`; a throw is one, at its path, but stack exhaustion ends the call. Each issue's path is work.
*/
const trial = (
  run: Impl['run'],
  value: unknown,
  path: readonly PropertyKey[],
  cap = MAX_ISSUES,
): Issue[] => {
  const from = top;
  const context: Context = { cap, issues: [], path: [...path] };
  try {
    run(value, context);
  } catch (error) {
    if (overflow(error)) {
      throw error;
    }
    if (error !== STOP) {
      note(context, `Threw: ${explain(error)}`);
    }
  }
  top = from;
  for (const { path: at } of context.issues) {
    steps += at.length;
  }
  return context.issues;
};

/**
Reports the closest of `runs`: of the members failing below the value
itself and knowing every key it holds, the one with the fewest issues
outside nested unions, the first on a tie. Each full check tried is charged
as a failed member is, and stops once it cannot be closer; past the budget,
or inside another untagged union's explanation, it reports nothing.
*/
export const closest =
  (runs: readonly Impl['run'][]): Impl['run'] =>
  (value, context) => {
    if (explaining) {
      return;
    }
    let best: Impl['run'] | undefined;
    let fewest = Infinity;
    const { length } = context.path;
    explaining = true;
    try {
      for (const run of runs) {
        const start = steps;
        const before = waste;
        const met = strangers;
        comparing = length;
        const issues = trial(run, value, context.path, Math.min(fewest, MAX_ISSUES));
        comparing = -1;
        if (
          strangers === met &&
          issues.length < fewest &&
          issues.every(({ path }) => path.length > length)
        ) {
          best = run;
          fewest = issues.length;
        }
        charge(start, before);
        spend(1);
        if (limit === 0) {
          return;
        }
      }
      best?.(value, context);
    } finally {
      explaining = false;
      comparing = -1;
    }
  };

/**
`pick`, reporting a failure: the issues `report` finds — at their paths, unless
a limit ends it — else a refusal met on the way, else the mismatch.
*/
export const choose = (
  members: readonly ((value: unknown) => unknown)[],
  report: Impl['run'],
  value: unknown,
  context: Context,
  label: string,
): unknown => {
  // A nested call is its own: it judges, though its caller's member is being tried.
  if (comparing !== -1 && frames === 1) {
    taken += 1;
    return value;
  }
  const before = deep;
  const out = pick(members, value);
  if (out !== FAIL) {
    return out;
  }
  const why = deep === before ? `Expected ${label}, received ${describe(value)}` : 'Too deep';
  let issues: Issue[] = [];
  // Only a top-level call explains: its verdict is given, so explaining can change none.
  if (frames === 1 && limit !== 0 && !drained) {
    const spent = [steps, waste, linear] as const;
    issues = trial(report, value, context.path);
    // Explaining is extra: one that runs out is undone, once a call, and the mismatch stands.
    if (limit === 0) {
      [steps, waste, linear] = spent;
      limit = MAX_DEPTH;
      drained = true;
      issues = [];
    }
  }
  if (limit === 0 || issues.length === 0) {
    issue(context, why);
  }
  for (const { message, path } of issues) {
    issue(context, message, path);
  }
  return value;
};

// ─── schemas, and schemas from elsewhere ─────────────────────────────────────────────────────────

/**
Keyed by the `~standard` object, which a spread or copy of the schema shares.
*/
const impls = new WeakMap<object, Impl>();

/**
A foreign issue's path segment as a key: `{ key }` unwrapped, anything but a key described.
*/
const segment = (each: unknown): PropertyKey => {
  const key =
    typeof each === 'object' && each !== null ? (each as StandardSchemaV1.PathSegment).key : each;
  return typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol'
    ? key
    : describe(key);
};

/**
Another copy of verax, or another library: trusted only through `~standard.validate`.
*/
const foreign = (spec: StandardSchemaV1): Impl => {
  /**
  The result, each part read once — or why it is none: a result is an object with array `issues` or a `value`.
  */
  const call = (
    value: unknown,
  ): string | Readonly<{ issues?: readonly unknown[]; value?: unknown }> => {
    const result: unknown = spec['~standard'].validate(value);
    // Any thenable, from any realm: `instanceof Promise` misses another realm's.
    const { then } = (result ?? {}) as { then?: unknown };
    if (typeof then === 'function') {
      try {
        // Swallow its rejection: the verdict is already given.
        Reflect.apply(then, result, [undefined, () => {}]);
      } catch {
        // A hostile thenable: the verdict stands.
      }
      return 'Asynchronous validation is not supported';
    }
    if (typeof result === 'object' && result !== null) {
      const { issues } = result as { issues?: unknown };
      if (Array.isArray(issues)) {
        return { issues };
      }
      if (issues === undefined && 'value' in result) {
        return { value: result.value };
      }
    }
    return 'Invalid Standard Schema result';
  };
  const fast = (value: unknown): unknown => {
    const result = call(value);
    return typeof result === 'string' || result.issues !== undefined ? FAIL : result.value;
  };
  return {
    check: fast,
    fast,
    run: (value, context) => {
      const result = call(value);
      if (typeof result === 'string') {
        issue(context, result);
        return value;
      }
      const { issues } = result;
      if (issues === undefined) {
        return result.value;
      }
      const { length } = issues;
      if (length === 0) {
        issue(context, 'Rejected');
      }
      for (let index = 0; index < length; index += 1) {
        const { message, path = [] } = issues[index] as StandardSchemaV1.Issue;
        const at = [...context.path];
        for (const each of path) {
          at.push(segment(each));
        }
        // Relaying is work: across nested frames, an issue is relayed at every boundary.
        steps += at.length;
        issue(context, typeof message === 'string' ? message : describe(message), at);
      }
      return value;
    },
  };
};

/**
This copy's checks for a schema it made — or a spread or copy of one — else an adapter.
*/
export const impl = (spec: StandardSchemaV1): Impl => {
  let properties: unknown;
  try {
    properties = spec['~standard'];
  } catch {
    // Adapted: the throw recurs, as an issue, when it validates.
  }
  return impls.get(properties as object) ?? foreign(spec);
};

// ─── the verbs ───────────────────────────────────────────────────────────────────────────────────

type Result<TOut> =
  | Readonly<{ issues?: undefined; value: TOut }>
  | Readonly<{ issues: readonly Issue[] }>;

// ※ verax-never-throws
/**
Never throws: an exception from a user callback or a hostile value (throwing getter, revoked Proxy, stack exhaustion) becomes an issue at its path. The fast check decides; only a rejection pays for the full check, which finds the issues.
*/
/**
Built ahead: at the stack's very edge, returning it needs no call that could overflow.
*/
const EXHAUSTED: Result<never> = Object.freeze({
  issues: Object.freeze([
    Object.freeze({
      message: 'Threw: stack exhausted',
      path: Object.freeze([]),
    }),
  ]),
});

/**
Never throws: an overflow anywhere in the walk, its bookkeeping, or finding
`self` from `spec` is the prebuilt rejection. Bound, it is each entry itself
— no frame of verax stands outside its `try`.
*/
function verify<TOut>(
  self: Impl<TOut> | undefined,
  value: unknown,
  spec?: StandardSchemaV1,
): Result<TOut> {
  const level = frames;
  const from = top;
  try {
    return walk(value, self ?? (impl(spec as StandardSchemaV1) as Impl<TOut>));
  } catch {
    // `close` itself can overflow: unwind by assignment alone.
    frames = level;
    top = from;
    if (level > 0) {
      exhausted = true;
      limit = 0;
    }
    return EXHAUSTED;
  }
}

/**
Whether the call is exhausted, now that a frame caught `thrown`: in a nested frame an overflow ends it.
*/
const exhausts = (nested: boolean, thrown: Readonly<{ error: unknown }> | undefined): boolean => {
  if (nested && thrown !== undefined && overflow(thrown.error)) {
    exhausted = true;
    limit = 0;
  }
  return exhausted;
};

const walk = <TOut>(value: unknown, self: Impl<TOut>): Result<TOut> => {
  const nested = frames > 0;
  const start = steps;
  const before = waste;
  const from = top;
  open();
  let output: unknown = FAIL;
  let thrown: Readonly<{ error: unknown }> | undefined;
  try {
    output = self.fast(value);
  } catch (error) {
    thrown = { error };
  }
  close(from);
  if (exhausts(nested, thrown)) {
    return EXHAUSTED;
  }
  // Past the budget no verdict stands, even one a callback inverted.
  if (output !== FAIL && limit !== 0) {
    return { value: output as TOut };
  }
  // A top-level full check has a budget of its own; a nested one repeats its fast check, which is waste.
  const complex = limit === 0;
  if (nested) {
    charge(start, before);
  }
  const context: Context = { issues: [], path: [] };
  open();
  let failed: Readonly<{ error: unknown }> | undefined;
  try {
    self.run(value, context);
  } catch (error) {
    failed = { error };
  }
  // Closed before describing the error: at the stack's edge that can overflow too.
  close(from);
  if (exhausts(nested, failed)) {
    return EXHAUSTED;
  }
  if (failed !== undefined && failed.error !== STOP) {
    note(context, `Threw: ${explain(failed.error)}`);
  }
  // Fail closed: a rejection the full check cannot explain is still a rejection.
  const tripped = limit === 0;
  if (tripped ? context.issues.at(-1)?.message !== TOO_COMPLEX : context.issues.length === 0) {
    note(
      context,
      tripped || complex
        ? TOO_COMPLEX
        : thrown === undefined
          ? 'Internal: fast and full checks disagree'
          : `Threw: ${explain(thrown.error)}`,
      [],
    );
  }
  return { issues: context.issues };
};

export const validate: <TSchema extends Schema>(
  value: unknown,
  spec: TSchema,
) => Result<Infer<TSchema>> = verify.bind(undefined, undefined);

/**
Makes a schema; `check` defaults to `fast` — a leaf or a refine builds nothing it could skip.
*/
export const schema = <TOut, TIn = TOut>(
  def: Def,
  fast: Impl<TOut>['fast'],
  run: Impl<TOut>['run'],
  check: Impl['check'] = fast,
): Schema<TOut, TIn> => {
  const self: Impl<TOut> = { check, fast, run };
  const properties: Schema<TOut, TIn>['~standard'] = {
    validate: verify.bind(undefined, self) as (value: unknown) => Result<TOut>,
    vendor: 'verax',
    version: 1,
  };
  impls.set(properties, self);
  return { def, '~standard': properties };
};

const format = ({ message, path }: Issue): string =>
  path.length === 0 ? message : `${path.map(String).join('.')}: ${message}`;

export class VeraxError extends TypeError {
  public override name = 'VeraxError';
  public readonly issues: readonly Issue[];
  public constructor(issues: readonly Issue[]) {
    super(issues.map((each) => format(each)).join('\n'));
    this.issues = issues;
  }
}

/**
Guards the value as the schema's input. Coercions run during the check but the value is not converted — use `parse` for the output.
*/
export const is = <TSchema extends Schema>(
  value: unknown,
  spec: TSchema,
): value is Input<TSchema> => {
  const level = frames;
  const from = top;
  try {
    const { check } = impl(spec);
    open();
    let ok = false;
    try {
      ok = check(value) !== FAIL;
    } catch (error) {
      // A throw is a failure; in a nested frame, an overflow ends the call.
      if (level > 0 && overflow(error)) {
        exhausted = true;
        limit = 0;
      }
    }
    close(from);
    return ok && limit !== 0;
  } catch {
    // As in `verify`: `close` itself can overflow.
    frames = level;
    top = from;
    if (level > 0) {
      exhausted = true;
      limit = 0;
    }
    return false;
  }
};

/**
Validates and returns the output — fresh, coercions applied; throws `VeraxError` listing every issue.
*/
export const parse = <TSchema extends Schema>(value: unknown, spec: TSchema): Infer<TSchema> => {
  const result = validate(value, spec);
  if (result.issues) {
    throw new VeraxError(result.issues);
  }
  return result.value;
};

export const assert: <TSchema extends Schema>(
  value: unknown,
  spec: TSchema,
) => asserts value is Input<TSchema> = (value, spec) => {
  parse(value, spec);
};

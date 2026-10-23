// Helpers the regression suites share.
import type * as Verax from './index.js';
import type { Issue } from './index.js';

export type Equal<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? true
    : false
  : false;
export const paths = (result: {
  readonly issues?: readonly Issue[] | undefined;
}): (readonly PropertyKey[])[] | undefined => result.issues?.map((found) => found.path);

/**
A proxy handler whose read of `key` throws.
*/
export const trap = (key: PropertyKey): ProxyHandler<unknown[]> => ({
  get: (target, property) => {
    if (property === key) {
      throw new Error(String(key));
    }
    return Reflect.get(target, property) as unknown;
  },
});

/**
A second copy of verax, as when two installed versions meet in one app.
*/
export const copy = async (): Promise<typeof Verax> => {
  const directory = `${Bun.env['TMPDIR'] ?? '/tmp'}/verax-copy-${process.pid}`;
  await Promise.all(
    ['core', 'index', 'sdl', 'standard', 'types'].map((name) =>
      Bun.write(`${directory}/${name}.ts`, Bun.file(new URL(`${name}.ts`, import.meta.url))),
    ),
  );
  return (await import(`${directory}/index.ts`)) as typeof Verax;
};

/**
Counts steps; past `cap` it throws what stack exhaustion throws, which no
union swallows — so where a walk would run away it unwinds instead, and the
count shows it.
*/
export const steps = (cap: number): { calls: number; tick: <TValue>(value: TValue) => TValue } => {
  const counter = {
    calls: 0,
    tick: <TValue>(value: TValue): TValue => {
      counter.calls += 1;
      if (counter.calls > cap) {
        throw new RangeError('Maximum call stack size exceeded (step budget)');
      }
      return value;
    },
  };
  return counter;
};

/**
Runs `thunk` beneath `frames` frames of the caller's own.
*/
export const beneath = (frames: number, thunk: () => unknown): unknown =>
  frames === 0 ? thunk() : beneath(frames - 1, thunk);

/**
A chain `levels` containers deep, innermost `null`.
*/
export const chain = (levels: number, link: (next: unknown) => unknown): unknown => {
  let value: unknown = null;
  for (let level = 0; level < levels; level += 1) {
    value = link(value);
  }
  return value;
};

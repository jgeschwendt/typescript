// Helpers the regression suites share.
import type * as Verax from '../src/index.js';
import type { Issue } from '../src/index.js';

export type Equal<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? true
    : false
  : false;
export const paths = (
  result: Readonly<{
    issues?: readonly Issue[] | undefined;
  }>,
): (readonly PropertyKey[])[] | undefined => result.issues?.map((found) => found.path);

/**
A proxy handler whose read of `key` throws.
*/
export const trap = (key: PropertyKey): ProxyHandler<object> => ({
  get: (target, property) => {
    if (property === key) {
      throw new Error(String(key));
    }
    return Reflect.get(target, property) as unknown;
  },
});

/**
The directory `copy(tag)` writes its copy of verax's source to.
*/
export const copied = (tag: string): string =>
  `${Bun.env['TMPDIR'] ?? '/tmp'}/verax-${tag}-${process.pid}`;

/**
A second copy of verax, as when two installed versions meet in one app — each `tag` its own,
whose code no other test has run.
*/
export const copy = async (tag = 'copy'): Promise<typeof Verax> => {
  const directory = copied(tag);
  await Promise.all(
    ['core', 'index', 'sdl', 'standard', 'types'].map((name) =>
      Bun.write(`${directory}/${name}.ts`, Bun.file(new URL(`../src/${name}.ts`, import.meta.url))),
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

/**
Runs `thunk` at every depth from the stack's edge to 300 frames above it, from callers of every
frame size: wherever a call meets the edge, warmed or cold, and with room to finish. A throw ends
only that run.
*/
export const sweep = (thunk: () => unknown): void => {
  for (let width = 0; width < 8; width += 1) {
    let deepest = -1;
    const edge = (level: number, ...pad: number[]): void => {
      try {
        edge(level + 1, ...pad);
      } catch {
        deepest = level;
      }
      if (level >= deepest - 300) {
        for (let frames = 0; frames < 4; frames += 1) {
          try {
            beneath(frames, thunk);
          } catch {
            // the edge, met before or after `thunk`
          }
        }
      }
    };
    edge(0, ...Array.from({ length: width }, (_value, at) => at));
  }
};

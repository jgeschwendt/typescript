// verax benchmark: every sample comes from a fresh process holding one case and one copy of verax;
// two copies in one process measured up to 35% apart on identical code, the later-compiled slower
import type * as Verax from '../src/index.js';

const argv = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
};
const base = option('base');
/**
Milliseconds of sampling per case, every process together.
*/
const budget = Number(option('time') ?? 1000);
/**
Milliseconds one sample runs: long enough that timer resolution and loop overhead vanish.
*/
const SLICE = 2;
/**
Samples one process takes; more time buys more processes, as a process's JIT lands a case in one of a few modes some 10% apart, however long it runs.
*/
const TURNS = 12;
/**
Processes per side and case.
*/
const ROUNDS = Math.max(4, Math.round(budget / TURNS / SLICE / (base === undefined ? 1 : 2)));

if (typeof Bun === 'undefined') {
  // src imports `./core.js`; node strips types but resolves only the file named
  process.getBuiltinModule('node:module').registerHooks({
    resolve: (specifier, context, next) =>
      next(specifier.replace(/^(?<file>\.{1,2}\/.+)\.js$/u, '$<file>.ts'), context),
  });
}

/**
`count` items, the last one `last` when given: an invalid input fails only at its end.
*/
const fill = (count: number, item: (at: number) => unknown, last?: unknown): unknown[] => {
  const items = Array.from({ length: count }, (_, at) => item(at));
  if (last !== undefined) {
    items[count - 1] = last;
  }
  return items;
};

const chain = (depth: number, note: unknown): unknown =>
  depth === 0 ? { next: null, note } : { next: chain(depth - 1, note), note: `n${depth}` };

const flat = (at: number) => ({
  active: at % 2 === 0,
  age: 20 + (at % 50),
  email: `user${at}@example.com`,
  id: `u${at}`,
  name: `User ${at}`,
  score: at * 1.5,
});

const item = (at: number) => ({
  discount: at % 3 === 0 ? null : 0.1,
  note: at % 2 === 0 ? undefined : `note ${at}`,
  price: 9.99 + at,
  quantity: at + 1,
  sku: `sku-${at}`,
  status: at % 4 === 0 ? 'BACKORDER' : 'IN_STOCK',
});

const order = (last?: unknown) => ({
  customer: { id: 'c1', name: 'Customer' },
  id: 'o1',
  items: fill(20, item, last),
  placedAt: '2026-11-23T00:00:00Z',
});

const TAGS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'] as const;

const tagged = (at: number) => ({ __typename: TAGS[at % TAGS.length], id: `t${at}`, value: at });

const untagged = (at: number) =>
  [at, `s${at}`, { x: at, y: -at }, { height: at, width: at + 1 }][at % 4];

const wide = (zip: unknown) => ({
  age: 40,
  city: 'Springfield',
  country: 'US',
  email: 'wide@example.com',
  first: 'Ada',
  last: 'Lovelace',
  phone: '555-0100',
  street: '1 Main St',
  tier: 'GOLD',
  zip,
});

/**
Every case as a call, each group's schema run through each verb on its valid and its invalid input; built from the copy it measures, whose WeakMaps know only its own schemas.
*/
const cases = (verax: typeof Verax) => {
  type Linked = {
    next: Linked | null;
    note?: string | undefined;
  };
  const {
    coerce,
    enums,
    float,
    id,
    int,
    list,
    literal,
    nullable,
    object,
    optional,
    record,
    refine,
    string,
    union,
  } = verax;
  const Flat = object('Flat', {
    active: verax.boolean(),
    age: int(),
    email: string(),
    id: id(),
    name: string(),
    score: float(),
  });
  const Node: Verax.Schema<Linked> = object('Node', {
    get next() {
      return nullable(Node);
    },
    note: optional(string()),
  });
  const groups: readonly (readonly [string, Verax.Schema, unknown, unknown])[] = [
    ['coerce', list(coerce(int(), Number)), fill(100, String), fill(100, String, 'x')],
    ['flat', Flat, flat(1), { ...flat(1), age: 1.5 }],
    ['list-int', list(int()), fill(1000, (at) => at), fill(1000, (at) => at, 1.5)],
    ['list-string', list(string()), fill(1000, (at) => `s${at}`), fill(1000, (at) => `s${at}`, 1)],
    [
      'nested',
      object('Order', {
        customer: object('Customer', { id: id(), name: string() }),
        id: id(),
        items: list(
          object('Item', {
            discount: nullable(float()),
            note: optional(string()),
            price: float(),
            quantity: int(),
            sku: id(),
            status: enums('Status', ['BACKORDER', 'IN_STOCK']),
          }),
        ),
        placedAt: string(),
      }),
      order(),
      order({ ...item(19), status: 'GONE' }),
    ],
    [
      'record',
      record(float()),
      Object.fromEntries(fill(100, (at) => [`k${at}`, at / 2]) as [string, unknown][]),
      Object.fromEntries(
        fill(100, (at) => [`k${at}`, at / 2], ['k99', 'x']) as [string, unknown][],
      ),
    ],
    ['recursive', Node, chain(50, 'end'), chain(50, 0)],
    [
      'refine',
      refine(Flat, 'Expected a name', (each) => each.name.length > 0),
      flat(2),
      { ...flat(2), name: '' },
    ],
    [
      'reordered',
      object('Wide', {
        age: int(),
        city: string(),
        country: string(),
        email: string(),
        first: string(),
        last: string(),
        phone: string(),
        street: string(),
        tier: enums('Tier', ['GOLD', 'SILVER']),
        zip: string(),
      }),
      wide('00001'),
      wide(1),
    ],
    [
      'tagged',
      list(
        union(
          'Tagged',
          TAGS.map((tag) => object(tag, { __typename: literal(tag), id: id(), value: int() })),
        ),
      ),
      fill(60, tagged),
      fill(60, tagged, { ...tagged(59), value: 'x' }),
    ],
    [
      'untagged',
      list(
        union('Untagged', [
          int(),
          string(),
          object('Point', { x: int(), y: int() }),
          object('Size', { height: int(), width: int() }),
        ]),
      ),
      fill(100, untagged),
      fill(100, untagged, { height: 1 }),
    ],
  ];
  return groups.flatMap(([name, schema, valid, invalid]) => {
    if (!verax.is(valid, schema) || verax.is(invalid, schema)) {
      throw new Error(`${name}: inputs are not one valid, one invalid`);
    }
    return (
      [
        ['valid', valid],
        ['invalid', invalid],
      ] as const
    ).flatMap(([kind, input]) => [
      { name: `${name}.is.${kind}`, run: () => verax.is(input, schema) },
      {
        name: `${name}.parse.${kind}`,
        run: () => {
          try {
            return verax.parse(input, schema);
          } catch (error) {
            return error;
          }
        },
      },
      { name: `${name}.validate.${kind}`, run: () => verax.validate(input, schema) },
    ]);
  });
};

const load = async (side: string) => {
  const url =
    side === 'base'
      ? new URL(`${base?.replace(/\/$/u, '')}/index.ts`, `file://${process.cwd()}/`)
      : new URL('../src/index.ts', import.meta.url);
  return cases((await import(url.href)) as typeof Verax);
};

/**
One process's samples of one case, in nanoseconds per call: calibrated to a slice, the first three only warming.
*/
const measure = async (name: string, side: string): Promise<number[]> => {
  const all = await load(side);
  const { run } = all.find((each) => each.name === name) as { run: () => unknown };
  const sink = { value: undefined as unknown };
  const time = (count: number): number => {
    const start = performance.now();
    for (let index = 0; index < count; index += 1) {
      sink.value = run();
    }
    return ((performance.now() - start) * 1e6) / count;
  };
  let count = 1;
  while (time(count) * count < 1e6) {
    count *= 2;
  }
  count = Math.max(1, Math.round((SLICE * 1e6) / time(count)));
  return Array.from({ length: TURNS + 3 }, () => time(count)).slice(3);
};

const mean = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length;

/**
The interquartile mean of `values` and its standard error, as a fraction of it: process results cluster in a few JIT modes, which a median jumps between and a mean of the middle half weighs.
*/
const center = (values: readonly number[]): readonly [number, number] => {
  const sorted = values.toSorted((left, right) => left - right);
  const { length } = sorted;
  const cut = Math.floor(length / 4);
  const kept = sorted.slice(cut, length - cut);
  const [low = 0, high = 0] = [kept[0], kept.at(-1)];
  // the trimmed mean's error, from the winsorized variance
  const winsorized = sorted.map((value) => Math.min(Math.max(value, low), high));
  const middle = mean(winsorized);
  const variance = mean(winsorized.map((value) => (value - middle) ** 2)) * (length / (length - 1));
  const average = mean(kept);
  return [average, Math.sqrt(variance / length) / (kept.length / length) / average];
};

const cell = (value: number | string): string =>
  (typeof value === 'number' ? value.toFixed(value < 100 ? 1 : 0) : value).padStart(10);
const percent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;
const write = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/**
One child process measuring `name` on `side`: this script, on this runtime.
*/
const spawn = (name: string, side: string): number[] => {
  const command = [
    process.execPath,
    ...process.execArgv,
    process.argv[1] as string,
    ...argv,
    '--case',
    name,
    '--side',
    side,
  ];
  const out =
    typeof Bun === 'undefined'
      ? process
          .getBuiltinModule('node:child_process')
          .spawnSync(command[0] as string, command.slice(1), {
            stdio: ['ignore', 'pipe', 'inherit'],
          })
          .stdout.toString()
      : Bun.spawnSync(command, { stderr: 'inherit' }).stdout.toString();
  return JSON.parse(out) as number[];
};

const only = option('case');
if (only === undefined) {
  const filter = option('filter') ?? '';
  const all = await load('work');
  const names = all.map(({ name }) => name).filter((name) => name.includes(filter));
  const width = Math.max(...names.map((name) => name.length));
  const columns = base === undefined ? ['ns/op', 'min', '±'] : ['base', 'work', 'min', 'Δ', '±'];
  write(`${'case'.padEnd(width)}${columns.map((column) => cell(column)).join('')}`);
  const results = [];
  for (const name of names) {
    const means = { base: [] as number[], work: [] as number[] };
    let min = Infinity;
    for (let round = 0; round < ROUNDS; round += 1) {
      // processes alternate sides, the lead swapping each round, so drift lands on both
      const sides = (
        base === undefined ? ['work'] : round % 2 === 0 ? ['base', 'work'] : ['work', 'base']
      ) as readonly (keyof typeof means)[];
      for (const side of sides) {
        const samples = spawn(name, side);
        means[side].push(center(samples)[0]);
        min = side === 'work' ? Math.min(min, ...samples) : min;
      }
    }
    const [work, error] = center(means.work);
    if (base === undefined) {
      // twice the standard error: a later run outside it differs
      results.push({ min, name, noise: 2 * error, ns: work });
      write(`${name.padEnd(width)}${cell(work)}${cell(min)}${cell(percent(2 * error))}`);
    } else {
      const [before, spread] = center(means.base);
      const delta = work / before - 1;
      // twice the standard error of the ratio: a delta inside it is noise
      const noise = 2 * Math.hypot(error, spread);
      results.push({ base: before, delta, min, name, noise, work });
      const values = [
        before,
        work,
        min,
        `${delta >= 0 ? '+' : ''}${percent(delta)}`,
        percent(noise),
      ];
      write(`${name.padEnd(width)}${values.map((value) => cell(value)).join('')}`);
    }
  }
  const json = option('json');
  if (json !== undefined) {
    const text = JSON.stringify(results, undefined, 2);
    await (typeof Bun === 'undefined'
      ? process.getBuiltinModule('node:fs').promises.writeFile(json, text)
      : Bun.write(json, text));
  }
} else {
  write(JSON.stringify(await measure(only, option('side') ?? 'work')));
}

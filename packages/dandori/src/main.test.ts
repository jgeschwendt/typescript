// End to end against a throwaway Git repo; each fake gate counts its runs in a file outside the tree.
import { $ } from 'bun';
import { expect, test } from 'bun:test';
import { type Config, type Gate, check, key, load } from './main.js';

const fastMs = 1000;
const slowMs = 2000;
const lastMs = 3000;
const second = 1000;

// a pre-push hook exports GIT_DIR and friends, which would aim the fixture's Git at this repo
const local = await $`git rev-parse --local-env-vars`.text();
for (const name of local.split('\n')) {
  Reflect.deleteProperty(process.env, name);
}

const fixture = async (): Promise<string> => {
  const root =
    await $`cd $(mktemp -d) && git init -q repo && cd repo && git config user.email dandori@test && git config user.name dandori && printf .env > .gitignore && printf a > a && git add -A && git commit -qm a && pwd`.text();
  return root.trim();
};

const fake = (name: string, ms: number, command = 'true'): Gate => ({
  command: `printf x >> ../${name}; ${command}`,
  ms,
  name,
});

const config = (gates: readonly Gate[], fixers: readonly Gate[] = []): Config => ({
  fixers,
  gates,
  inputs: ['.env'],
});

// the gate's runs, one x each
const count = async (root: string, name: string): Promise<string> =>
  $`cat ../${name}`.cwd(root).nothrow().quiet().text();

const seconds = (text: string): string => text.replaceAll(/\d+\.\d+s/gu, 'Ns');

const run = async (root: string, input: Config): ReturnType<typeof check> => {
  const { ok, out } = await check(root, input);
  return { ok, out: seconds(out) };
};

test('a pass is stamped; an edit, a new file or a new input re-runs it; unstamped gates always run', async () => {
  const root = await fixture();
  const index = await Bun.file(`${root}/.git/index`).bytes();
  const list = config([
    fake('slow', slowMs),
    { ...fake('always', lastMs), stamp: false },
    fake('fast', fastMs),
  ]);
  expect(key(root, list.inputs)).toBe(key(root, list.inputs));
  expect(await run(root, list)).toEqual({
    ok: true,
    out: 'fast ran in Ns\nslow ran in Ns\nalways ran in Ns',
  });
  expect(await run(root, list)).toEqual({
    ok: true,
    out: 'fast stamped\nslow stamped\nalways ran in Ns',
  });
  await Bun.write(`${root}/a`, 'b');
  await check(root, list);
  await Bun.write(`${root}/b`, 'b');
  await check(root, list);
  await Bun.write(`${root}/.env`, 'X=1');
  await check(root, list);
  expect([await count(root, 'fast'), await count(root, 'always')]).toEqual(['xxxx', 'xxxxx']);
  expect(await Bun.file(`${root}/.git/index`).bytes()).toEqual(index);
});

test('a same-size edit in the second the index was written still changes the key', async () => {
  await Bun.sleep(second - (Date.now() % second));
  const root = await fixture();
  const before = key(root, []);
  await Bun.write(`${root}/a`, 'b');
  // the copy is made in a later second than the index it copies
  await Bun.sleep(second);
  expect(key(root, [])).not.toBe(before);
});

test('a failure is never stamped, and the logged c/p runs the likelier failure first', async () => {
  const root = await fixture();
  // one slow pass on record outweighs the cheaper declared cost
  await Bun.write(`${root}/.git/dandori/log.tsv`, 'never\t\t90000\tpass');
  const list = config([fake('never', 1), fake('fail', fastMs, 'echo broke; exit 1')]);
  const failed = { ok: false, out: 'fail failed in Ns\nbroke' };
  expect(await run(root, list)).toEqual(failed);
  expect(await run(root, list)).toEqual(failed);
  expect([await count(root, 'never'), await count(root, 'fail')]).toEqual(['', 'xx']);
});

test('a pass earned on a dirty tree is found again once that tree is committed', async () => {
  const root = await fixture();
  await Bun.write(`${root}/b`, 'b');
  const dirty = key(root, []);
  const lint = config([fake('lint', 1)]);
  await check(root, lint);
  await $`git add -A && git commit -qm b`.cwd(root);
  const head = await $`git rev-parse 'HEAD^{tree}'`.cwd(root).text();
  expect(dirty).toStartWith(`${head.trim()} `);
  expect(await run(root, lint)).toEqual({ ok: true, out: 'lint stamped' });
});

test('fix mode runs the fixers first and keys the gates on the tree they leave', async () => {
  const root = await fixture();
  const fix = config([fake('lint', 1, 'grep -q fixed a')], [fake('fixer', 1, 'printf fixed > a')]);
  expect(await run(root, fix)).toEqual({ ok: true, out: 'fixer ran in Ns\nlint ran in Ns' });
  expect(await run(root, { ...fix, fixers: [] })).toEqual({ ok: true, out: 'lint stamped' });
  expect(await run(root, fix)).toEqual({ ok: true, out: 'fixer ran in Ns\nlint stamped' });
  expect(await run(root, fix)).toEqual({ ok: true, out: 'fixer stamped\nlint stamped' });
});

test('a tree Git cannot read fails the key instead of keying a stale index', async () => {
  const root = await fixture();
  await $`printf b > b && chmod 000 b`.cwd(root);
  expect(() => key(root, [])).toThrow('Permission denied');
});

test('the bin loads dandori.config.ts, verifies by default and fixes with --fix', async () => {
  const root = await fixture();
  await Bun.write(
    `${root}/dandori.config.ts`,
    "export const fixers = [{ command: 'printf fixed > a', ms: 1, name: 'fixer' }];\nexport const gates = [{ command: 'grep fixed a || exit 1', ms: 1, name: 'lint' }];\nexport const inputs = [];\n",
  );
  const loaded = await load(root);
  expect(loaded.gates).toHaveLength(1);
  const verify = await $`${import.meta.dir}/cli.ts`.cwd(root).nothrow().quiet();
  const fix = await $`${import.meta.dir}/cli.ts --fix`.cwd(root).nothrow().quiet();
  expect([verify.exitCode, seconds(verify.stdout.toString())]).toEqual([
    1,
    'lint failed in Ns\n\n',
  ]);
  expect([fix.exitCode, seconds(fix.stdout.toString())]).toEqual([
    0,
    'fixer ran in Ns\nlint ran in Ns\n',
  ]);
});

test('a config without the three arrays is refused', async () => {
  const root = await fixture();
  await Bun.write(`${root}/dandori.config.ts`, 'export const gates = [];\n');
  expect(load(root)).rejects.toThrow('must export fixers, gates and inputs arrays');
});

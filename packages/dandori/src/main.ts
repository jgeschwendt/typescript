// dandori runs each gate once per tree and remembers the pass (docs/dandori.html).

/**
A gate is a shell command run at the repo root; `ms` is its measured cost, its place in the order
until the log has history; `stamp: false` marks a gate whose result the key does not determine.
*/
type Gate = Readonly<{ command: string; ms: number; name: string; stamp?: false }>;

/**
`fixers` run first in fix mode, in order; `inputs` are files outside the tree the gates read.
*/
type Config = Readonly<{
  fixers: readonly Gate[];
  gates: readonly Gate[];
  inputs: readonly string[];
}>;

const columns = 4;
const limit = 500;
const second = 1000;

/**
Runs `command` in `cwd` with `parameters` as $1…, timed, with an explicit env: Bun's default child env
ignores keys deleted from process.env.
*/
const sh = (
  cwd: string,
  command: string,
  parameters: readonly string[] = [],
): Readonly<Record<'err' | 'out', string> & { code: number; ms: number }> => {
  const start = performance.now();
  const { exitCode, stderr, stdout } = Bun.spawnSync(['sh', '-c', command, 'sh', ...parameters], {
    cwd,
    env: { ...process.env },
  });
  return {
    code: exitCode,
    err: stderr.toString(),
    ms: Math.round(performance.now() - start),
    out: stdout.toString(),
  };
};

// ※ dandori-tree-key
/**
The tree `git add -A && git commit` would record, so HEAD^{tree} once that state is committed,
written through a copy of the index so the real one is never touched; then a hash of each input,
and the platform. The copy keeps the index's mtime: a fresh one would hide from Git's racy-clean
check a same-size edit made in the second the index was written.
*/
const key = (root: string, inputs: readonly string[]): string => {
  const { code, err, out } = sh(
    root,
    `index=$(git rev-parse --git-path index)
export GIT_INDEX_FILE=$(mktemp)
trap 'rm -f "$GIT_INDEX_FILE"' EXIT
cp -p "$index" "$GIT_INDEX_FILE" && git add -A && git write-tree || exit
for input; do { cat "$input" 2>/dev/null; true; } | git hash-object --stdin; done`,
    inputs,
  );
  if (code) {
    throw new Error(err);
  }
  return `${out.trim().replaceAll('\n', ' ')} ${process.platform}-${process.arch}`;
};

// ※ dandori-stamp-soundness
/**
Runs the fixers in order, then the un-stamped gates by ascending c/p, stopping at the first failure.
The log lives under the Git common dir, shared by every worktree and never in a tree.
*/
const check = async (
  root: string,
  { fixers, gates, inputs }: Config,
): Promise<Readonly<{ ok: boolean; out: string }>> => {
  const path = `${sh(root, 'git rev-parse --path-format=absolute --git-common-dir').out.trim()}/dandori/log.tsv`;
  const file = Bun.file(path);
  const log = ((await file.exists()) ? await file.text() : '')
    .split('\n')
    .filter(Boolean)
    .map((line): Readonly<{ gate: string; isPass: boolean; ms: number; tree: string }> => {
      const [gate = '', tree = '', ms = '', outcome = ''] = line.split('\t', columns);
      return { gate, isPass: outcome === 'pass', ms: Number(ms), tree };
    });
  // ※ dandori-passes-only
  const isStamped = (gate: Gate, tree: string): boolean =>
    gate.stamp !== false &&
    log.some((run) => run.isPass && run.gate === gate.name && run.tree === tree);
  // mean cost, the declared ms counted as one run, over the Laplace-smoothed failure probability
  const score = (gate: Gate): number => {
    const runs = log.filter((run) => run.gate === gate.name);
    return (
      ((gate.ms + runs.reduce((sum, run) => sum + run.ms, 0)) * (runs.length + 2)) /
      (runs.length + 1) /
      (runs.filter((run) => !run.isPass).length + 1)
    );
  };
  const lines: string[] = [];
  let tree = key(root, inputs);
  const failed = [...fixers, ...gates.toSorted((left, right) => score(left) - score(right))].find(
    (gate) => {
      if (isStamped(gate, tree)) {
        lines.push(`${gate.name} stamped`);
        return false;
      }
      const { code, ms, out } = sh(root, `exec 2>&1\n${gate.command}`);
      const next = fixers.includes(gate) ? key(root, inputs) : tree;
      // a fixer that rewrote the tree proved nothing about the tree it started from
      log.push({ gate: gate.name, isPass: code === 0, ms, tree: next === tree ? tree : '' });
      tree = next;
      lines.push(
        `${gate.name} ${code ? 'failed' : 'ran'} in ${(ms / second).toFixed(1)}s`,
        ...(code ? [out.trimEnd()] : []),
      );
      return code !== 0;
    },
  );
  const rows = log
    .slice(-limit)
    .map((run) => `${run.gate}\t${run.tree}\t${run.ms}\t${run.isPass ? 'pass' : 'fail'}`);
  // written whole and renamed into place: a concurrent run never reads half a log
  await Bun.write(`${path}.${process.pid}`, rows.join('\n'));
  process.getBuiltinModule('node:fs').renameSync(`${path}.${process.pid}`, path);
  return { ok: failed === undefined, out: lines.join('\n') };
};

/**
Whether a loaded module exports the three arrays a config needs.
*/
const isConfig = (value: unknown): value is Config =>
  typeof value === 'object' &&
  value !== null &&
  ['fixers', 'gates', 'inputs'].every((name) => Array.isArray(Reflect.get(value, name)));

/**
The consumer's dandori.config.ts: its `fixers`, `gates` and `inputs` exports.
*/
const load = async (root: string): Promise<Config> => {
  const config: unknown = await import(`${root}/dandori.config.ts`);
  if (!isConfig(config)) {
    throw new Error(`${root}/dandori.config.ts must export fixers, gates and inputs arrays`);
  }
  return config;
};

export { check, type Config, type Gate, key, load };

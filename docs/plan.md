# Plan

The toolchain configs and their release. `AGENTS.md` carries the map,
invariants and hazards, `README.md` the contract; this file is what is open.

## Hazards

- In a shift sandbox, bun cannot write its default tempdir: `bun install` and
  `bun test` (js-plugins.test.js installs the packed tarball) need
  `BUN_TMPDIR=$TMPDIR BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache`.
- `stele check` liveness resolves `bun`; run it through `mise x`, or a
  bun-less PATH reports false drift.
- Until 1 lands, any `bun install` on a main-based checkout reruns lefthook's
  postinstall (`trustedDependencies`), which rewrites the bare repo's shared
  `hooks/pre-commit` and `pre-push`; hk's launchers survive as `*.old`.
- The `cleanup` worktree holds uncommitted edits on top of six unlanded
  commits. Never clean, reset or remove it.

## Next

1. Land `cleanup` (hk replaces lefthook, bun 1.4.2, eslint 10 + unicorn 77,
   terse config comments). Its `@jlg/oxlint` changeset is `minor`, so the
   Version Packages PR needs the owner's `release:signed-off` label. Until it
   lands, main still runs lefthook on bun 1.3.14.
2. After 1: `hk install --mise --force` once per clone — it replaces the
   lefthook shim, which otherwise passes every commit unchecked.
3. verax (branch `verax`): the `sdl()` union gap waits on the owner's
   decision, thread f02e24bf.
4. Prune the 21 local scratch branches at 8fb5574 (`a` … `y`, `demo/share`)
   and `toolchain/drop-node-shim` (its node-shadow removal is on main) —
   owner's call; 8fb5574 is an ancestor of main, so they hold nothing unique.
   `demo/share` has a worktree; remove that first.

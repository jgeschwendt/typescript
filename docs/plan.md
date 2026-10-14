# Plan

The toolchain configs and their release. `AGENTS.md` carries the map,
invariants and hazards, `README.md` the contract; this file is what is open.

## Hazards

- In a shift sandbox, bun cannot write its default tempdir: `bun install` and
  `bun test` (js-plugins.test.js installs the packed tarball) need
  `BUN_TMPDIR=$TMPDIR BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache`.
- `stele check` liveness resolves `bun`; run it through `mise x`, or a
  bun-less PATH fails every liveness check.
- Every checkout shares the bare repo's `hooks/`, which `hk install --mise`
  fills from `hk.pkl` (each hook runs `mise x -- hk`). A `bun install` in a
  checkout still at a pre-hk commit reruns lefthook's postinstall (its
  `trustedDependencies`) and overwrites hk's hooks with lefthook shims for
  every checkout; rerun `hk install --mise --force` after one. The reverse
  also bites: hk's hooks fail every commit in a checkout whose `mise.toml`
  lacks the hk pin.

## Next

1. Land `cleanup` (hk replaces lefthook, bun 1.4.3, eslint 10 + unicorn 77,
   `@jlg/oxlint` rebuilt as a dynamic `index.js`, the eslint parity
   snapshot). Its `@jlg/oxlint` changesets are `patch` (0.1.2 ships on
   merge); the owner takes another pass before any minor.
2. After 1: `hk install --mise --force` once — every checkout shares the bare
   repo's hooks dir. Not while any checkout sits at a pre-hk commit (`verax`,
   `js-plugins`, `import-order`, `demo-share`, grove's pool slots): the hook
   runs `mise x -- hk`, which fails every commit where `mise.toml` lacks the
   hk pin.
3. verax (branch `verax`): the `sdl()` union gap waits on the owner's
   decision, thread f02e24bf.
4. Prune the 21 local scratch branches at 8fb5574 (`a` … `y`, `demo/share`)
   and `toolchain/drop-node-shim` (its node-shadow removal is on main) —
   owner's call; 8fb5574 is an ancestor of main, so they hold nothing unique.
   `demo/share` has a worktree; remove that first. `next` (nothing ahead of
   main) goes too; `feat/oxlint-js-plugins` and `docs/import-order-dropped`
   carry unlanded work — land or close them.

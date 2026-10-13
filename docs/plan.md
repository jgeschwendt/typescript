# Plan

The toolchain configs and their release. `AGENTS.md` carries the map,
invariants and hazards, `README.md` the contract; this file is what is open.

## Hazards

- In a shift sandbox, bun cannot write its default tempdir: `bun install` and
  `bun test` (js-plugins.test.js installs the packed tarball) need
  `BUN_TMPDIR=$TMPDIR BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache`.
- `stele check` liveness resolves `bun`; run it through `mise x`, or a
  bun-less PATH fails every liveness check.
- The bare repo's shared `hooks/pre-commit` and `pre-push` are lefthook shims
  (rewritten 2026-10-13 by a `bun install`); hk's launchers sit in `*.old`.
  Until 1 lands, any `bun install` on a main-based checkout reruns lefthook's
  postinstall (`trustedDependencies`) and rewrites them again; `cleanup`'s
  commits run under a lefthook with no config there, so unchecked.
- The `cleanup` worktree holds uncommitted edits on top of six unlanded
  commits. Never clean, reset or remove it.

## Next

1. Land `cleanup` (hk replaces lefthook, bun 1.4.2, eslint 10 + unicorn 77,
   terse config comments). Its `@jlg/oxlint` changeset is `minor`, so the
   Version Packages PR needs the owner's `release:signed-off` label. Until it
   lands, main still runs lefthook on bun 1.3.14.
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

# dandori

```stele
kind: container
purpose: "@jlg/dandori — the dandori bin keys the tree, skips each gate whose pass is logged at that key and runs the rest by c/p; the consumer's dandori.config.ts names the gates. Private."
commands:
  test: bun run --filter '@jlg/dandori' test
invariants:
  - claim: "STAMP SOUNDNESS — a gate is skipped only when its pass was logged at the same key (tree hash, a hash of each configured input, platform-arch); that holds only while every stamped gate is deterministic and reads nothing outside the key but node_modules installed from the lockfile and the mise-pinned tools: a gate that reads anything else is `stamp: false`, or its input joins `inputs`"
    anchor: ※ dandori-stamp-soundness
  - claim: PASSES ONLY — only a pass is a stamp; a failure is logged for the order's failure estimate and always re-runs
    anchor: ※ dandori-passes-only
  - claim: TREE KEY — the key's tree is `git write-tree` after `git add -A` into an mtime-preserving copy of the index, so the real index is never written, Git's racy-clean check still sees a same-second edit, and a dirty tree's key equals HEAD^{tree} once that exact state is committed; the pass the agent loop earns is the stamp pre-push finds
    anchor: ※ dandori-tree-key
edges:
  depends: [packages/oxlint]
```

<!-- @stele -->
<!-- @end -->

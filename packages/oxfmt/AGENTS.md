# oxfmt

```stele
kind: container
purpose: Canonical oxfmt settings — formatter companion to @jlg/lint. oxfmtrc.json ships one opinion (singleQuote); index.js merges it in (oxfmt has no `extends`). Repo-local keys stay in the consumer.
commands:
  test: bun run --filter '@jlg/oxfmt' test
hazards:
  - claim: MIRRORED PAIR — every key in this oxfmtrc.json must also appear in the repo-root .oxfmtrc.jsonc; oxfmt has no `extends`, so the base cannot compose by reference and the two are edited together
    anchor: ※ oxfmt-mirror-root
edges:
  depends: [packages/oxlint]
```

<!-- @stele -->
<!-- @end -->

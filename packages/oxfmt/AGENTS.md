# oxfmt

```stele
kind: container
purpose: Canonical oxfmt settings — formatter companion to @jlg/oxlint. oxfmtrc.json ships one opinion (singleQuote); index.js merges it in (oxfmt has no `extends`). Repo-local keys stay in the consumer.
commands:
  test: bun run --filter '@jlg/oxfmt' test
edges:
  depends: [packages/oxlint]
```

<!-- @stele -->
<!-- @end -->

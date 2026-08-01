# oxfmt

```stele
kind: container
purpose: Canonical oxfmt settings — formatter companion to @jlg/oxlint. oxfmtrc.json ships one opinion (singleQuote); index.mjs merges it in (oxfmt has no `extends`). Repo-local keys stay in the consumer.
commands:
  test: bun run --filter '@jlg/oxfmt' test
hazards:
  - claim: MIRRORED PAIR — every key in this oxfmtrc.json must also appear in the repo-root .oxfmtrc.jsonc; oxfmt has no `extends`, so the base cannot compose by reference and the two are edited together
    anchor: packages/oxfmt/README.md#relationship-to-the-repo-root
```

<!-- stele:begin router -->
<!-- stele:end -->

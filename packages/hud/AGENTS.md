# hud

```stele
kind: container
purpose: "@jlg/hud — zero-dependency comment layer: mount() renders pins, a picker and a thread panel into <hud>; threads in, hud:* events out. serve.ts hosts a dir for review over browser and agent sockets."
commands:
  demo: bun run --filter '@jlg/hud' demo
  glyphs: bun run --filter '@jlg/hud' glyphs
  serve: bun packages/hud/src/serve.ts <dir> [--port N] [--store FILE] [--watch <dir>]…
  test: bun run --filter '@jlg/hud' test
edges:
  depends: [packages/oxlint]
```

<!-- @stele -->
<!-- @end -->

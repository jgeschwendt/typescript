---
'verax': patch
---

`verax`: `tuple([a, b, …])` accepts an array of exactly those items, each checked against its own schema, and infers `[A, B, …]`. A wrong length is one issue, `Expected length 2, received 3`; each failing item is reported at its index. `Def` gains `{ kind: 'tuple', of }`, and `sdl()` refuses a tuple, as GraphQL has none.

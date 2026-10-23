---
'verax': minor
---

verax returns as a real library: a minimal, GraphQL-shaped successor to superstruct. Every schema is a Standard Schema V1, with `record(value)` for `Record<string, V>` maps; `sdl()` from `verax/sdl` emits GraphQL SDL, with a `__typename: literal(name)` union tag left implicit as in GraphQL. Replaces the 0.1.x placeholder stubs. `parse` and `validate` return a fresh snapshot of what they read — never the input or its getters, proxies or prototypes — and a shape is read once, on first use.

---
'verax': patch
---

`verax`: a ground-up rewrite that replaces the 0.1 API. It targets TypeScript 7+, ships ESM only and runs on Node ≥24. Four verbs check a value against a schema: `is`, `assert`, `parse` and `validate`. Every schema is a Standard Schema V1, and `sdl()` from `verax/sdl` emits GraphQL SDL from them. Validation is bounded in depth and work, and never throws: a hostile value or a throwing callback becomes an issue.

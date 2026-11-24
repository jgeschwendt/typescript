---
'verax': patch
---

`verax`: a schema's `~standard.validate` is now typed as synchronous, returning verax's `Result` rather than `Result | Promise<Result>`, while the schema stays assignable to `StandardSchemaV1`. Three issue messages read better: a required key that is absent says `Expected Int, missing` (an explicit `undefined` still says `received undefined`), a nullable leaf names null (`Expected Int | null, received "x"`), and an object that is not plain, such as one from another realm, is `received non-plain object` instead of `received object`. Code that matches on message text should update.

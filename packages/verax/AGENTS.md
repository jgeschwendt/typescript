# verax

```stele
kind: container
purpose: verax — minimal, zero-dep, GraphQL-shaped runtime types (superstruct successor). Each schema is a Standard Schema V1; sdl() emits SDL. The one package with a build step (tsc on prepack).
commands:
  test: bun run --filter verax test
invariants:
  - claim: MODERN ONLY — TypeScript 7+, ESM-only (exports "import" only, no CJS), Node >=22; never add a CJS build, node10 types fallback, or downlevel target
    anchor: packages/verax/README.md#requirements
  - claim: NEVER THROWS — validate (and ~standard.validate, is, and the checks inside assert and parse) turns any exception from a user callback or hostile value into an issue at its path; union members that throw count as failed members, except on stack exhaustion (a RangeError whose message names the call stack), which fails the whole check
    anchor: ※ verax-never-throws
hazards:
  - claim: DEF IDENTITY — refine and coerce must reuse the inner schema's def object; sdl() detects name collisions and dedupes union members by def identity, so a fresh def breaks sdl naming
    anchor: ※ verax-def-identity
  - claim: "HOT PATH — per-run code never calls Object.entries/Object.keys or iterator helpers (values().every etc.), and `is` runs check-only paths that allocate nothing (outside refine) while parse/validate allocate only the output snapshot; shapes resolve once into plans. Measured on bun 1.4.2 / node 24: iterator helpers 2–11× slower, Object.entries 24–95 ns per call; every perf change is kept only with a before/after run of the benchmark harness"
    anchor: ※ verax-hot-path
  - claim: TYPE TESTS — the `true satisfies Equal<…>` assertions fail only under tsc; bun test strips types, so ci.yaml and the hk pre-push gate (hk.pkl) run `bunx tsc --noEmit` in packages/verax (the lockfile compiler) separately
    anchor: ※ verax-type-tests
edges:
  depends: [packages/oxlint]
```

<!-- @stele -->
<!-- @end -->

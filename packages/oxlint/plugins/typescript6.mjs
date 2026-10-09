// Points typescript-eslint's `typescript` import at the TS 6 API package, for
// every plugin here that loads typescript-eslint code (typescript-js, and
// import-js's parser). Imported for its side effect; ES module caching runs it
// once per process.
import Module from 'node:module';
import { fileURLToPath } from 'node:url';

// typescript-eslint imports `typescript` and throws on 7.0, which ships no JS
// API; TypeScript's sanctioned bridge is the TS 6 API package. Only
// typescript-eslint's own imports are pointed at it, inside oxlint's plugin
// process — the repo, tsc and tsgolint keep TypeScript 7.
// (verified 2026-10-08 · typescript 7.0.2: "typescript-eslint does not support
// TS 7.0" without this; both rules fire with it)
const typescript6 = fileURLToPath(
  import.meta.resolve('@typescript/typescript6'),
);

const fromTypescriptEslint = (importer = '') =>
  /[/\\](?:@typescript-eslint|ts-api-utils)[/\\]/u.test(importer);

if (typeof Module.registerHooks === 'function') {
  Module.registerHooks({
    resolve: (specifier, context, nextResolve) =>
      nextResolve(
        specifier === 'typescript' && fromTypescriptEslint(context.parentURL)
          ? typescript6
          : specifier,
        context,
      ),
  });
} else {
  // Bun (`bun --bun oxlint`) has no `module.registerHooks`, and its runtime
  // `Bun.plugin` resolver never sees a CommonJS `require()` issued from
  // node_modules — typescript-eslint is CommonJS, so the consumer's TS 7 loaded
  // anyway. Bun's CommonJS loader does route through `Module._resolveFilename`.
  // (verified 2026-10-09 · packed install with typescript 7.0.2, hoisted and
  // isolated: js-plugins.test.js)
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function _resolveFilename(
    request,
    parent,
    ...rest
  ) {
    return request === 'typescript' && fromTypescriptEslint(parent?.filename)
      ? typescript6
      : Reflect.apply(resolveFilename, this, [request, parent, ...rest]);
  };
}

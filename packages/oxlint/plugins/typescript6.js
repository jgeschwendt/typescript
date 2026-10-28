const Module = process.getBuiltinModule('node:module');
const { fileURLToPath } = process.getBuiltinModule('node:url');

/** typescript-eslint throws on TS 7, which ships no JS API; a URL, as Node's resolve hook returns */
const typescript6 = import.meta.resolve('@typescript/typescript6');

const isFromTypescriptEslint = (importer) =>
  /[/\\](?:@typescript-eslint|ts-api-utils)[/\\]/u.test(importer);

if (typeof Module.registerHooks === 'function') {
  // a path handed to nextResolve is a specifier, which a Windows drive letter reads as a URL scheme
  Module.registerHooks({
    resolve: (specifier, context, nextResolve) =>
      specifier === 'typescript' && isFromTypescriptEslint(context.parentURL)
        ? { shortCircuit: true, url: typescript6 }
        : nextResolve(specifier, context),
  });
} else {
  // bun has no registerHooks, and Bun.plugin misses CommonJS require() from node_modules
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function _resolveFilename(request, parent, ...rest) {
    return request === 'typescript' && isFromTypescriptEslint(parent?.filename)
      ? fileURLToPath(typescript6)
      : Reflect.apply(resolveFilename, this, [request, parent, ...rest]);
  };
}

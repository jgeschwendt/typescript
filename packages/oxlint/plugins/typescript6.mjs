import Module from 'node:module';
import { fileURLToPath } from 'node:url';

/** typescript-eslint throws on TS 7, which ships no JS API */
const typescript6 = fileURLToPath(import.meta.resolve('@typescript/typescript6'));

const isFromTypescriptEslint = (importer = '') =>
  /[/\\](?:@typescript-eslint|ts-api-utils)[/\\]/u.test(importer);

if (typeof Module.registerHooks === 'function') {
  Module.registerHooks({
    resolve: (specifier, context, nextResolve) =>
      nextResolve(
        specifier === 'typescript' && isFromTypescriptEslint(context.parentURL)
          ? typescript6
          : specifier,
        context,
      ),
  });
} else {
  // bun has no registerHooks, and Bun.plugin misses CommonJS require() from node_modules
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function _resolveFilename(request, parent, ...rest) {
    return request === 'typescript' && isFromTypescriptEslint(parent?.filename)
      ? typescript6
      : Reflect.apply(resolveFilename, this, [request, parent, ...rest]);
  };
}

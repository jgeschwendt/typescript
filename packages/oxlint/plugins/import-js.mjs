// eslint-plugin-import, loaded here so oxlintrc.jsonc names it by a relative
// path: a bare specifier in an extended config resolves from the consumer's
// symlinked node_modules/@jlg/oxlint, whose ancestors hold none of this
// package's dependencies under an isolated install, while this module's own
// import resolves from its real path. Rules run through host.mjs.
import plugin from 'eslint-plugin-import';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { host } from './host.mjs';
import './typescript6.mjs';

const require = createRequire(import.meta.url);

/**
 * The parser eslint-module-utils' ExportMap reads imported modules with. It
 * takes the rule context's `languageOptions.parser`, whose `parse` oxlint
 * leaves unimplemented — so no-deprecated, and any rule that follows an
 * import into its target, reported "Parse errors in imported module" instead.
 * typescript-eslint's parser reads JS and TS alike; loaded on first use, by
 * absolute path (Bun's `createRequire` resolves a bare name from the working
 * directory once `Module._resolveFilename` is patched). `require` caches it.
 */
const parserPath = fileURLToPath(
  import.meta.resolve('@typescript-eslint/parser'),
);

export default host(plugin, 'import-js', (context) => ({
  languageOptions: {
    ...context.languageOptions,
    get parser() {
      return require(parserPath);
    },
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
}));

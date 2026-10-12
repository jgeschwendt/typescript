// eslint-plugin-import, loaded here so oxlintrc.jsonc names it by a relative
// path: a bare specifier in an extended config resolves from the consumer's
// symlinked node_modules/@jlg/oxlint, whose ancestors hold none of this
// package's dependencies under an isolated install, while this module's own
// import resolves from its real path. Rules run through host.mjs.
// Rules load one by one: the plugin's index requires no-unused-modules, which
// needs ESLint <=9 internals (FileEnumerator) and throws at load on ESLint 10.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { host } from './host.mjs';
import './typescript6.mjs';

const require = createRequire(import.meta.url);

// lib/index.js, resolved but never loaded; rules by absolute path (see parserPath)
const index = import.meta.resolve('eslint-plugin-import');
const names = [
  'no-deprecated',
  'no-extraneous-dependencies',
  'no-import-module-exports',
  'no-internal-modules',
  'no-relative-packages',
  'no-restricted-paths',
  'no-unresolved',
  'no-useless-path-segments',
  'order',
];

/**
 * The parser eslint-module-utils' ExportMap reads imported modules with. It
 * takes the rule context's `languageOptions.parser`, whose `parse` oxlint
 * leaves unimplemented — so no-deprecated, and any rule that follows an
 * import into its target, reported "Parse errors in imported module" instead.
 * typescript-eslint's parser reads JS and TS alike; loaded on first use, by
 * absolute path (Bun's `createRequire` resolves a bare name from the working
 * directory once `Module._resolveFilename` is patched). `require` caches it.
 */
const parserPath = fileURLToPath(import.meta.resolve('@typescript-eslint/parser'));

export default host(
  {
    rules: Object.fromEntries(
      names.map((name) => [name, require(fileURLToPath(new URL(`rules/${name}.js`, index)))]),
    ),
  },
  'import-js',
  (context) => ({
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
  }),
);

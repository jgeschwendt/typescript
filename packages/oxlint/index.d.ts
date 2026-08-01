// Types for the JS entry. `oxlint` is a peerDependency, so this type-only import
// costs consumers nothing at runtime and pins the surface to oxlint's own config
// type — `OxlintConfig` (which types `extends` as `OxlintConfig[]`, matching the
// object-extends contract the JS loader enforces; see index.mjs).
import type { OxlintConfig } from 'oxlint';

// The parsed `oxlintrc.jsonc` base config, exported for consumers who want raw
// access to the ruleset.
export declare const base: OxlintConfig;

// Compose the `@jlg/oxlint` base with a consumer config: returns the config with
// the base prepended to `extends`, so any `extends` the consumer passed still
// composes on top.
export declare function defineConfig(config?: OxlintConfig): OxlintConfig;

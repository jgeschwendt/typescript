// Types for the JS entry. `oxfmt` is a peerDependency, so this type-only import
// costs consumers nothing at runtime and pins the surface to oxfmt's own config
// type — `Oxfmtrc` (the shape of an `oxfmt.config.*` / `.oxfmtrc.json`).
import type { Oxfmtrc } from 'oxfmt';

// The parsed `oxfmtrc.json` base config, exported for consumers who want raw
// access to the settings.
export declare const base: Oxfmtrc;

// Merge the `@jlg/oxfmt` base with a consumer config: returns a shallow merge
// with the base first and the consumer's keys winning (oxfmt has no `extends`,
// so composition is a merge, not a reference).
export declare function defineConfig(config?: Oxfmtrc): Oxfmtrc;

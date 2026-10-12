import type { OxlintConfig } from 'oxlint';

/** oxlintrc.jsonc parsed, its jsPlugins paths absolutized */
export declare const base: OxlintConfig;

/** prepends the base to `extends`, re-appends its file-named overrides, sets root `settings` */
export declare function defineConfig(config?: OxlintConfig): OxlintConfig;

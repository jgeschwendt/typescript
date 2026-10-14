import type { OxlintConfig } from 'oxlint';

/** the whole base as one flat config: yours merged over it, your overrides last; `env` forces detection */
export declare function defineConfig(
  config?: OxlintConfig & { env?: Partial<{ next: boolean; react: boolean; typescript: boolean }> },
): OxlintConfig;

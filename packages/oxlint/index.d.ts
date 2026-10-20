import type { OxlintConfig } from 'oxlint';

/** the whole base as one flat config: yours merged over it, your overrides last; `env` forces detection, a numeric `env.node` the runtime floor */
export declare function defineConfig(
  config?: Omit<OxlintConfig, 'env'> & {
    env?: Record<string, boolean | number | undefined> &
      Partial<{
        bun: boolean;
        next: boolean;
        node: boolean | number;
        react: boolean;
        typescript: boolean;
      }>;
  },
): OxlintConfig;

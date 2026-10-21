import type { OxlintConfig } from 'oxlint';

/** the whole base as one flat config: yours merged over it, your overrides last; `env` forces detection, a numeric `env.node` the runtime floor; `root` forces whether this is the lint root (default: the config sits in oxlint's cwd), which alone gets `options` */
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
    root?: boolean;
  },
): OxlintConfig;

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

/** the base's naming-convention entries after the severity, per file set: an override's options replace the base's, so a consumer restates the rule as `['warn', ...own, ...namingConvention.tsx]` */
export declare const namingConvention: Readonly<
  Record<'default' | 'route' | 'tsx', readonly Record<string, unknown>[]>
>;

/** every rule the base turns off, keyed by its config name, to the fact that turns it off: a native rule off in `rules`, a `-js/` rule its JS plugin never runs */
export declare const off: Readonly<Record<string, string>>;

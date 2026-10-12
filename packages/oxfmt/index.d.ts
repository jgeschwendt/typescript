import type { Oxfmtrc } from 'oxfmt';

export declare const base: Oxfmtrc;

/** shallow merge, consumer keys winning: oxfmt has no `extends` */
export declare function defineConfig(config?: Oxfmtrc): Oxfmtrc;

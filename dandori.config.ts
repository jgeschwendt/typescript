// The gates `mise run check` and the agent's Stop hook run (docs/dandori.html).
import type { Gate } from '@jlg/dandori';

// each gate's cost measured on this repo, its place in the order until the log has history
const bunTestMs = 30_000;
const oxfmtMs = 100;
const oxlintMs = 2400;
const steleMs = 200;
const tscMs = 200;

/**
Fix mode runs these first, in this order: oxfmt formats whatever oxlint's fixes rewrote.
*/
const fixers: readonly Gate[] = [
  { command: 'bunx oxlint --fix', ms: oxlintMs, name: 'oxlint --fix' },
  { command: 'bunx oxfmt', ms: oxfmtMs, name: 'oxfmt' },
];

const gates: readonly Gate[] = [
  { command: 'bun test', ms: bunTestMs, name: 'bun test' },
  { command: 'bunx oxfmt --check', ms: oxfmtMs, name: 'oxfmt --check' },
  { command: 'bunx oxlint', ms: oxlintMs, name: 'oxlint' },
  // ※ stele-unstamped
  { command: 'stele check && stele emit --check', ms: steleMs, name: 'stele', stamp: false },
  {
    command:
      'bunx tsc -p . && (cd packages/dandori && bunx tsrs -p .) && cd packages/verax && bunx tsc --noEmit',
    ms: tscMs,
    name: 'tsc',
  },
];

/**
mise loads .env into every gate's environment, and .gitignore keeps it out of the tree.
*/
const inputs = ['.env'];

export { fixers, gates, inputs };

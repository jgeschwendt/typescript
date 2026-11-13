#!/usr/bin/env bun
// `dandori` verifies the tree at the working directory; `dandori --fix` runs the fixers first.
import { check, load } from './main.js';

/**
The exit code is the verdict.
*/
const main = async (root: string, argv: readonly string[]): Promise<void> => {
  const config = await load(root);
  const { ok, out } = await check(
    root,
    argv.includes('--fix') ? config : { ...config, fixers: [] },
  );
  await Bun.write(Bun.stdout, `${out}\n`);
  process.exitCode = ok ? 0 : 1;
};

if (import.meta.main) {
  await main(process.cwd(), process.argv);
}

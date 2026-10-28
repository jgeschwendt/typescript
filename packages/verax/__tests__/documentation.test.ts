// The docs page proves itself: tsc checks its blocks as one module, and running that module
// prints exactly the output the page shows under each block.
import { expect, test } from 'bun:test';
import { copied, copy } from './_helpers.js';
import { execute } from '../docs/repl.js';

const page = await Bun.file(new URL('../docs/index.html', import.meta.url)).text();
const entities: Record<string, string> = { '#39': "'", amp: '&', gt: '>', lt: '<', quot: '"' };
const decode = (html: string): string =>
  html.replaceAll(
    /&(?<entity>#39|amp|gt|lt|quot);/gu,
    (_, entity: string) => entities[entity] ?? '',
  );
const blocks = Array.from(
  page.matchAll(
    /<pre\s+class="snippet"\s+data-ts\s*><code>(?<code>[^]*?)<\/code><\/pre>(?:\s*<pre\s+class="snippet"\s+data-out\s*>(?<out>[^]*?)<\/pre>)?/gu,
  ),
  ([, code = '', out = '']) => ({ code: decode(code), out: decode(out.replace(/^\n/u, '')) }),
);
const cache = new URL('.cache/docs/', new URL('../node_modules/', import.meta.url));
const config = new URL('tsconfig.json', cache);
const source = new URL('docs.ts', cache);

test('the blocks type-check as one module', async () => {
  await Bun.write(
    source,
    blocks
      .map(({ code }) => code)
      .join('\n')
      .replaceAll("'verax/sdl'", "'../../../src/sdl.js'")
      .replaceAll("'verax'", "'../../../src/index.js'"),
  );
  await Bun.write(
    config,
    JSON.stringify({ extends: '../../../tsconfig.json', include: ['docs.ts'] }),
  );
  const tsc = Bun.spawnSync(['bunx', 'tsc', '-p', config.pathname]);
  expect(tsc.stdout.toString()).toBe('');
  expect(tsc.exitCode).toBe(0);
}, 30_000);

test('each block prints the output the page shows under it', async () => {
  // a copy of its own: running the page must not warm the code the stack-edge tests time
  await copy('docs');
  const program = new URL('program.ts', cache);
  const printed = await execute(
    blocks.map(({ code }) => code),
    { verax: `${copied('docs')}/index.ts`, 'verax/sdl': `${copied('docs')}/sdl.ts` },
    async (text) => {
      await Bun.write(program, text);
      return import(program.href);
    },
  );
  expect(printed).toEqual(blocks.map(({ out }) => out));
});

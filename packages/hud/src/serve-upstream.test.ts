import { afterAll, expect, spyOn, test } from 'bun:test';

const { mkdtempSync } = process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');

const directory = mkdtempSync(`${tmpdir()}/hud-upstream-`);
const seen: string[] = [];
const origin = Bun.serve({
  fetch: (request) => {
    const { pathname, search } = new URL(request.url);
    seen.push(`${request.method} ${pathname}${search}`);
    const routes: Record<string, () => Response> = {
      '/data.json': () => Response.json({ ok: true }),
      '/docs': () => new Response(undefined, { headers: { location: '/docs/' }, status: 308 }),
      '/docs/': () =>
        new Response('<html><body><p>docs</p></body></html>', {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    };
    return routes[pathname]?.() ?? new Response('gone', { status: 404 });
  },
  hostname: '127.0.0.1',
  port: 0,
});
Bun.env['XDG_STATE_HOME'] = `${directory}/state`;
Bun.argv.splice(2, Infinity, `http://127.0.0.1:${origin.port}/ignored`, '--port', '0');
spyOn(console, 'log').mockReturnValue();
// serve.js reads argv once at import: this file needs `bun test --isolate`, a module registry of its own
const { server } = await import('./serve.js');
const base = server.url.href;
const get = async (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${base}${path}`, { redirect: 'manual', ...init });

afterAll(async () => {
  await server.stop(true);
  await origin.stop(true);
});

test('relays the upstream: html injected, other types untouched, redirects and 404s as sent', async () => {
  const [page, data, redirect, gone, head, client] = await Promise.all([
    get('docs/?a=1'),
    get('data.json'),
    get('docs'),
    get('nope'),
    get('docs/', { method: 'HEAD' }),
    get('__hud/client.js'),
  ]);
  expect(await page.text()).toBe(
    '<html><body><p>docs</p><hud></hud><script type="module" src="/__hud/client.js"></script></body></html>',
  );
  expect([
    page.status,
    page.headers.get('content-type'),
    page.headers.get('cache-control'),
  ]).toEqual([200, 'text/html; charset=utf-8', 'no-store']);
  expect([await data.json(), data.headers.get('content-type')]).toEqual([
    { ok: true },
    'application/json;charset=utf-8',
  ]);
  expect([redirect.status, redirect.headers.get('location')]).toEqual([308, '/docs/']);
  expect([gone.status, await gone.text()]).toEqual([404, 'gone']);
  expect(head.status).toBe(200);
  const script = await client.text();
  expect(script.includes('/__hud/ws')).toBe(true);
  expect(seen.toSorted((left, right) => left.localeCompare(right))).toEqual([
    'GET /data.json',
    'GET /docs',
    'GET /docs/?a=1',
    'GET /nope',
    'HEAD /docs/',
  ]);
});

test('the default store is slugged from the upstream host:port', async () => {
  const socket = new WebSocket(`${base.replace('http', 'ws')}__hud/ws`);
  await new Promise((done) => {
    socket.addEventListener('open', done);
  });
  socket.send(JSON.stringify({ name: 'open', page: '/', selector: 'p', text: 'hi', x: 1, y: 2 }));
  const file = Bun.file(`${directory}/state/hud/127.0.0.1-${origin.port}.json`);
  await Bun.sleep(50);
  socket.close();
  expect(await file.exists()).toBe(true);
});

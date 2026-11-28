import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterAll, expect, spyOn, test } from 'bun:test';
import type { Thread } from './index.js';

type Stored = Thread & { context?: string };

const { mkdtempSync } = process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');

const bunResponse = Response;
const get = fetch;
const directory = mkdtempSync(`${tmpdir()}/hud-`);
const pages = `${directory}/docs`;
const parse: (text: string) => Stored[] = JSON.parse;
const backlog: string[] = [];
await Bun.write(
  `${pages}/index.html`,
  `<html><body><p id="intro">Before any heading</p><h1>Docs</h1><h2>Data
  root</h2><img alt="Five stations" src="a.png"><button aria-label="Zoom">+</button></body></html>`,
);
await Bun.write(`${pages}/page.css`, 'p {}');
Bun.env['XDG_STATE_HOME'] = `${directory}/state`;
// the state dir is watched too: the store written inside a watched dir must stay silent
Bun.argv.splice(2, Infinity, pages, '--port', '0', '--watch', `${directory}/state`);
const log = spyOn(console, 'log').mockReturnValue();
const { server } = await import('./serve.js');
const base = server.url.href;
const store = Bun.file(`${directory}/state/hud/${pages.slice(1).replaceAll('/', '-')}.json`);

const until = async (check: () => boolean): Promise<void> => {
  if (check()) {
    return;
  }
  await Bun.sleep(5);
  await until(check);
};
const listen = async (path: string): Promise<{ frames: string[]; socket: WebSocket }> => {
  const frames: string[] = [];
  const socket = new WebSocket(`${base.replace('http', 'ws')}__hud/${path}`);
  socket.addEventListener('message', ({ data }) => {
    frames.push(String(data));
  });
  await until(() => socket.readyState === WebSocket.OPEN);
  await Bun.sleep(20);
  return { frames, socket };
};
const watch = async (): Promise<string[]> => {
  const { frames, socket } = await listen('watch');
  socket.close();
  return frames;
};
const text = async (path: string): Promise<string> => {
  const response = await get(`${base}${path}`);
  return response.text();
};
const post = async (path: string, body: object): Promise<[number, unknown]> => {
  const response = await get(`${base}__hud/${path}`, {
    body: JSON.stringify(body),
    method: 'POST',
  });
  return [response.status, await response.json()];
};
const saved = async (): Promise<Stored[]> => parse(await store.text());
const ids = async (): Promise<string[]> => {
  const threads = await saved();
  return threads.map(({ id }) => id);
};

afterAll(async () => {
  await server.stop(true);
  await GlobalRegistrator.unregister();
});

test('serves the dir with the layer injected, nothing cached', async () => {
  const responses = await Promise.all(
    ['', 'page.css', 'nope', '__hud/client.js'].map(async (path) => get(`${base}${path}`)),
  );
  const [page, css, , client] = await Promise.all(
    responses.map(async (response) => response.text()),
  );
  expect(log).toHaveBeenCalledWith(`${base} · watch ws://127.0.0.1:${server.port}/__hud/watch`);
  expect(page).toEndWith(
    '<hud></hud><script type="module" src="/__hud/client.js"></script></body></html>',
  );
  expect([css, client?.includes('/__hud/ws')]).toEqual(['p {}', true]);
  expect(responses.map(({ headers, status }) => [status, headers.get('cache-control')])).toEqual([
    [200, 'no-store'],
    [200, 'no-store'],
    [404, 'no-store'],
    [200, 'no-store'],
  ]);
});

test('the store starts empty under XDG_STATE_HOME; watch replays exactly the unanswered', async () => {
  const { frames, socket } = await listen('ws');
  const emit = (name: string, detail: object): void => {
    socket.send(JSON.stringify({ ...detail, name }));
  };
  for (const comment of ['asked', 'first\nline', 'closed']) {
    emit('open', { context: 'img "a"', page: '/', selector: 'img', text: comment, x: 1, y: 2 });
  }
  await until(() => frames.length === 4);
  const [answered, waiting, closed] = await ids();
  await post('reply', { id: answered, text: 'answered' });
  emit('reply', { id: waiting, text: 'again' });
  emit('resolve', { id: closed });
  await until(() => frames.length === 7);
  socket.close();
  backlog.push(
    `comment ${waiting!.slice(0, 8)} / img "a" | first line`,
    `reply ${waiting!.slice(0, 8)} / | again`,
  );
  expect([frames[0], await watch()]).toEqual(['[]', backlog]);
});

test('browser events persist, broadcast and stream; agent replies land live', async () => {
  const { frames } = await listen('watch');
  const html = await text('');
  GlobalRegistrator.register({
    settings: { handleDisabledFileLoadingAsSuccess: true },
    url: base,
  });
  const sockets: WebSocket[] = [];
  class Recorded extends WebSocket {
    public constructor(...rest: ConstructorParameters<typeof WebSocket>) {
      super(...rest);
      sockets.push(this);
    }
  }
  // the server under test answers with Bun's Response; the client's sockets are recorded
  Object.assign(globalThis, { Response: bunResponse, WebSocket: Recorded });
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html.replace(/<script.+script>/u, ''), 'text/html');
  document.body.replaceChildren(...parsed.body.childNodes);
  await import('./client.js');
  const shadow = document.querySelector('hud > div')!.shadowRoot!;
  const pins = (): number => shadow.querySelectorAll('button[data-status]').length;
  await until(() => pins() === 3);
  const host = document.querySelector('hud')!;
  const send = async (name: string, detail: object, count = frames.length + 1): Promise<void> => {
    host.dispatchEvent(new CustomEvent(`hud:${name}`, { detail }));
    await until(() => frames.length === count);
  };
  const open = async (selector: string): Promise<void> =>
    send('open', { selector, text: `on\n${selector}`, x: 5, y: 6 });
  await open('img');
  await open('button');
  await open('#intro');
  const opened = await ids();
  const [img, button, intro] = opened.slice(3);
  const [image, zoom, lead] = [img!.slice(0, 8), button!.slice(0, 8), intro!.slice(0, 8)];
  await send('reply', { id: img, text: 'more' });
  await send('resolve', { id: img });
  await send('reopen', { id: img });
  await send('anchor', { id: button, selector: 'h1', x: 7, y: 8 }, frames.length);
  await send('delete', { id: intro });
  await send('delete', { id: 'gone' }, frames.length);
  await until(() => pins() === 5);
  expect(frames).toEqual([
    ...backlog,
    `comment ${image} / img "Five stations" · under "Data root" | on img`,
    `comment ${zoom} / button "Zoom" · under "Data root" | on button`,
    `comment ${lead} / p "Before any heading" | on #intro`,
    `reply ${image} / | more`,
    `status ${image} resolved`,
    `status ${image} open`,
    `deleted ${lead}`,
  ]);
  const threads = await saved();
  expect(threads.find(({ id }) => id === button)).toMatchObject({
    context: 'h1 "Docs"',
    selector: 'h1',
    x: 7,
    y: 8,
  });
  expect([
    await post('reply', { id: 'nope', text: 'x' }),
    await post('reply', { id: '', text: 'x' }),
    await post('reply', { id: image, text: 'agent says' }),
  ]).toMatchObject([
    [404, { error: '0 threads match' }],
    [409, { error: '5 threads match' }],
    [200, { messages: [{}, { author: 'user' }, { author: 'agent', text: 'agent says' }] }],
  ]);
  await until(() => shadow.textContent.includes('agent says'));
  expect(await watch()).toEqual([...backlog, `comment ${zoom} / h1 "Docs" | on button`]);
  await send('reply', { id: img, text: 'after' });
  expect(await watch()).toContain(`reply ${image} / | after`);
  expect(await post('resolve', { id: backlog[1]!.split(' ', 2)[1] })).toMatchObject([
    200,
    { status: 'resolved' },
  ]);
  await until(() => frames.at(-1) === `status ${backlog[1]!.split(' ', 2)[1]} resolved`);
  expect(parse(await text('__hud/threads'))).toEqual(await saved());
  // the client's socket, then two watches: the dropped client reconnects as the fourth
  sockets[0]!.close();
  await until(() => sockets[3]?.readyState === WebSocket.OPEN);
  await send('resolve', { id: img });
  await until(() => shadow.querySelectorAll('[data-status="resolved"]').length === 6);
});

test('a changed file reaches the browser as a reload frame; the client swaps css or reloads', async () => {
  // a new directory is itself a change: settle it before the frames under test
  await Bun.write(`${pages}/sub/page.css`, 'p {}');
  await Bun.sleep(100);
  const { frames } = await listen('ws');
  frames.length = 0;
  await Bun.write(`${pages}/.hidden.css`, 'x');
  await Bun.write(`${pages}/node_modules/x.js`, 'x');
  await Bun.write(`${pages}/sub/page.css`, 'p {}');
  await Bun.write(`${pages}/new.html`, '<p></p>');
  await until(() => frames.length === 2);
  await Bun.sleep(100);
  expect(frames).toEqual(['{"reload":"sub/page.css"}', '{"reload":"new.html"}']);

  const [first, second, icon] = [
    ['stylesheet', '/page.css'],
    ['stylesheet', '/sub/page.css'],
    ['icon', '/i.png'],
  ].map(([relation, href]) =>
    Object.assign(document.createElement('link'), { href, rel: relation }),
  );
  document.head.replaceChildren(first!, second!, icon!);
  const reload = spyOn(location, 'reload').mockReturnValue();
  scrollTo(0, 42);
  await Bun.write(`${pages}/sub/page.css`, 'p { color: red }');
  await until(() => second!.href.includes('hud='));
  expect([first!.href, reload.mock.calls.length]).toEqual([`${base}page.css`, 0]);
  await Bun.write(`${pages}/other.css`, 'p {}');
  await until(() => first!.href.includes('hud='));
  expect(reload.mock.calls.length).toBe(0);
  await Bun.write(`${pages}/new.html`, '<p>2</p>');
  await until(() => reload.mock.calls.length === 1);
  expect(sessionStorage.getItem('hud:scroll')).toBe('42');
  scrollTo(0, 0);
  dispatchEvent(new Event('load'));
  expect(sessionStorage.getItem('hud:scroll')).toBeNull();
  expect(scrollY).toBe(42);
});

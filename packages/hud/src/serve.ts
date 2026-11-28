import type { Message, Thread } from './mount.js';

type Stored = Thread & { context?: string };
type Name = 'anchor' | 'delete' | 'open' | 'reopen' | 'reply' | 'resolve';
type Detail = Omit<Stored, 'messages' | 'status'> & { name: Name; text: string };
type Edit = (thread: Stored, detail: Detail, author: Message['author']) => string;

const { mkdirSync, renameSync, watch, writeFileSync } = process.getBuiltinModule('node:fs');
const { dirname, join, resolve } = process.getBuiltinModule('node:path');

// a burst of file events becomes one frame per path after this many milliseconds
const debounce = 50;
const headers = { 'cache-control': 'no-store' };
const channels = new Set(['/__hud/watch', '/__hud/ws']);
const load: (text: string) => Stored[] = JSON.parse;
const read: (text: string) => Detail = JSON.parse;
const option = (name: string): string | undefined =>
  Bun.argv.find((_argument, index, argv) => argv[index - 1] === `--${name}`);
const options = (name: string): string[] =>
  Bun.argv.flatMap((argument, index, argv) => (argv[index - 1] === `--${name}` ? [argument] : []));
const target = String(Bun.argv[2]);
const upstream = /^https?:\/\//u.test(target) ? new URL(target) : undefined;
const root = resolve(target);
const store =
  option('store') ??
  `${Bun.env['XDG_STATE_HOME'] ?? `${Bun.env['HOME']}/.local/state`}/hud/${(upstream?.host ?? root.slice(1)).replaceAll(/[^\w.-]+/gu, '-')}.json`;
mkdirSync(dirname(store), { recursive: true });
const threads: Stored[] = [];
try {
  threads.push(...load(await Bun.file(store).text()));
} catch {
  // missing or unreadable: no threads
}

const flat = (text = ''): string => text.replaceAll(/[\n\r]+/gu, ' ');
const short = ({ id }: Stored): string => id.slice(0, 8);
const said = (thread: Stored, message: Message): string =>
  `${message === thread.messages[0] ? `comment ${short(thread)} ${thread.page} ${flat(thread.context)}` : `reply ${short(thread)} ${thread.page}`} | ${flat(message.text)}`;
const unanswered = (): string[] =>
  threads
    .filter(({ status }) => status === 'open')
    .flatMap((thread) =>
      thread.messages
        .slice(thread.messages.findLastIndex(({ author }) => author === 'agent') + 1)
        .map((message) => said(thread, message)),
    );
const matching = (id: string): Stored[] => threads.filter((thread) => thread.id.startsWith(id));
const status = (thread: Stored, value: Stored['status']): string => {
  thread.status = value;
  return `status ${short(thread)} ${value}`;
};

const edits: Record<Exclude<Name, 'open'>, Edit> = {
  anchor: (thread, { context, selector, x, y }) => {
    Object.assign(thread, { context, selector, x, y });
    return '';
  },
  delete: (thread) => {
    threads.splice(threads.indexOf(thread), 1);
    return `deleted ${short(thread)}`;
  },
  reopen: (thread) => status(thread, 'open'),
  reply: (thread, { text }, author) => {
    const at = new Date();
    const message = { at: at.toISOString(), author, text };
    thread.messages.push(message);
    return author === 'user' ? said(thread, message) : '';
  },
  resolve: (thread) => status(thread, 'resolved'),
};

/**
Persist, publish the threads to every browser and a non-empty `line` to every watcher; returns the threads frame.
*/
const commit = (to: Bun.Server<string> | Bun.ServerWebSocket<string>, line: string): string => {
  const frame = JSON.stringify(threads);
  writeFileSync(`${store}.tmp`, JSON.stringify(threads, undefined, 1));
  renameSync(`${store}.tmp`, store);
  to.publish('/__hud/ws', frame);
  if (line) {
    to.publish('/__hud/watch', line);
  }
  return frame;
};

const agent = (bun: Bun.Server<string>, edit: Edit, detail: Detail): Response => {
  const found = matching(detail.id);
  const [thread] = found;
  if (!thread || found.length > 1) {
    return Response.json(
      { error: `${found.length} threads match` },
      { headers, status: thread ? 409 : 404 },
    );
  }
  commit(bun, edit(thread, detail, 'agent'));
  return Response.json(thread, { headers });
};

const missing = (): Response => new Response('not found', { headers, status: 404 });
const inject = (html: string): string =>
  html.replace(
    '</body>',
    '<hud></hud><script type="module" src="/__hud/client.js"></script></body>',
  );

/**
Fetch the request's path from the upstream with its method, redirects left to the browser; relay status, content-type and location, the layer injected into HTML.
*/
const relay = async ({ method }: Request, { pathname, search }: URL): Promise<Response> => {
  // dot-relative: a path opening `//` is a path, never a protocol-relative host
  const response = await fetch(new URL(`.${pathname}${search}`, upstream), {
    method,
    redirect: 'manual',
  });
  const relayed = new Headers(headers);
  for (const name of ['content-type', 'location']) {
    const value = response.headers.get(name);
    if (value !== null) {
      relayed.set(name, value);
    }
  }
  const html = relayed.get('content-type')?.startsWith('text/html') === true;
  return new Response(html ? inject(await response.text()) : response.body, {
    headers: relayed,
    status: response.status,
  });
};

const server = Bun.serve<string>({
  fetch: async (request, bun) => {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/__hud/client.js') {
      const { outputs } = await Bun.build({ entrypoints: [`${import.meta.dir}/client.ts`] });
      return new Response(outputs[0], { headers });
    }
    if (pathname === '/__hud/reply' || pathname === '/__hud/resolve') {
      return agent(
        bun,
        pathname === '/__hud/reply' ? edits.reply : edits.resolve,
        read(await request.text()),
      );
    }
    if (pathname === '/__hud/threads') {
      return Response.json(threads, { headers });
    }
    if (channels.has(pathname)) {
      return bun.upgrade(request, { data: pathname }) ? undefined : missing();
    }
    if (upstream) {
      return relay(request, url);
    }
    const file = Bun.file(join(root, pathname.endsWith('/') ? `${pathname}index.html` : pathname));
    if (!(await file.exists())) {
      return missing();
    }
    const body = file.type.startsWith('text/html') ? inject(await file.text()) : file;
    return new Response(body, { headers: { ...headers, 'content-type': file.type } });
  },
  hostname: '127.0.0.1',
  port: Number(option('port') ?? 8765),
  websocket: {
    message: (socket, data) => {
      const detail = read(String(data));
      if (detail.name === 'open') {
        const { context, page, selector, x, y } = detail;
        detail.id = crypto.randomUUID();
        threads.push({
          context,
          id: detail.id,
          messages: [],
          page,
          selector,
          status: 'open',
          x,
          y,
        });
      }
      const [thread] = matching(detail.id);
      if (!thread) {
        return;
      }
      const edit = edits[detail.name === 'open' ? 'reply' : detail.name];
      socket.send(commit(socket, edit(thread, detail, 'user')));
    },
    open: (socket) => {
      const frames = socket.data === '/__hud/ws' ? [JSON.stringify(threads)] : unanswered();
      socket.subscribe(socket.data);
      for (const frame of frames) {
        socket.send(frame);
      }
    },
  },
});

// a change under a watched dir reaches every browser as `{"reload": <path under that dir>}`
const changed = new Set<string>();
const timer: { id?: Timer } = {};
const ignored = (directory: string, path: string): boolean =>
  path.split('/').some((part) => part.startsWith('.') || part === 'node_modules') ||
  [store, `${store}.tmp`].includes(join(directory, path));
for (const directory of [
  upstream ? [] : [root],
  options('watch').map((path) => resolve(path)),
].flat()) {
  watch(directory, { recursive: true }, (_event, name) => {
    const path = String(name);
    if (ignored(directory, path)) {
      return;
    }

    changed.add(path);
    clearTimeout(timer.id);
    timer.id = setTimeout(() => {
      for (const reload of changed) {
        server.publish('/__hud/ws', JSON.stringify({ reload }));
      }
      changed.clear();
    }, debounce);
  });
}

console.log(`${server.url.href} · watch ws://${server.hostname}:${server.port}/__hud/watch`);

export { server };

const { dir: directory } = import.meta;
const files = new Map([
  ['/', 'index.html'],
  ['/page.css', 'page.css'],
]);
const server = Bun.serve({
  async fetch({ url }) {
    const { pathname } = new URL(url);
    if (pathname === '/main.js') {
      const { outputs } = await Bun.build({ entrypoints: [`${directory}/main.ts`] });
      return new Response(outputs[0], { headers: { 'content-type': 'text/javascript' } });
    }
    const file = files.get(pathname);
    return file === undefined
      ? new Response('not found', { status: 404 })
      : new Response(Bun.file(`${directory}/${file}`));
  },
  hostname: '127.0.0.1',
  port: 4173,
});
console.log(`http://${server.hostname}:${server.port}/`);

import { type Thread, mount, resolve } from './index.js';

// a dropped socket retries after this many milliseconds
const retry = 1000;
const labelLength = 120;

const textOf = (node: Node): string => (node.textContent ?? '').trim().replaceAll(/\s+/gu, ' ');

/**
`element` for a text-only reader: its tag, its alt, aria-label or opening text, and the heading it sits under.
*/
const contextOf = (element: Element): string => {
  const label =
    element.getAttribute('alt') ??
    element.getAttribute('aria-label') ??
    textOf(element).slice(0, labelLength);
  const heading = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].findLast(
    (candidate) => candidate.compareDocumentPosition(element) === Node.DOCUMENT_POSITION_FOLLOWING,
  );
  return `${element.localName} "${label}"${heading ? ` · under "${textOf(heading)}"` : ''}`;
};

const host = document.querySelector('hud');
const hud = mount(host);
const parse: (text: string) => Thread[] = JSON.parse;
const live: { socket?: WebSocket } = {};
const connect = (): void => {
  const socket = new WebSocket(`ws://${location.host}/__hud/ws`);
  live.socket = socket;
  socket.addEventListener('message', ({ data }) => {
    hud.threads = parse(String(data));
  });
  socket.addEventListener('close', () => {
    setTimeout(connect, retry);
  });
};
connect();
for (const name of ['anchor', 'delete', 'open', 'reopen', 'reply', 'resolve'] as const) {
  host?.addEventListener(`hud:${name}`, ({ detail }) => {
    const element = 'selector' in detail ? resolve(detail.selector) : undefined;
    live.socket?.send(
      JSON.stringify({ ...detail, context: element && contextOf(element), name, page: hud.page }),
    );
  });
}

import { type Thread, mount } from '../src/index.js';

const now = (): string => {
  const date = new Date();
  return date.toISOString();
};
const seeded = now();
const hud = mount(undefined, {
  page: '/',
  threads: [
    {
      id: 't1',
      messages: [
        { at: seeded, author: 'user', text: 'Say which tiers drove it.' },
        { at: seeded, author: 'agent', text: 'The team tier, mostly — I will add the split.' },
      ],
      page: '/',
      selector: 'main > p:nth-of-type(2)',
      status: 'open',
      x: 30,
      y: 20,
    },
    {
      id: 't2',
      messages: [{ at: seeded, author: 'user', text: 'Round to one decimal.' }],
      page: '/',
      selector: 'table',
      status: 'resolved',
      x: 60,
      y: 50,
    },
  ],
});
const host = document.querySelector('hud');
const update = (id: string, change: (thread: Thread) => Partial<Thread>): void => {
  hud.threads = hud.threads.map((thread) =>
    thread.id === id ? { ...thread, ...change(thread) } : thread,
  );
};

host?.addEventListener('hud:open', ({ detail: { text, ...anchor } }) => {
  const id = crypto.randomUUID();
  const message = { at: now(), author: 'user', text } as const;
  hud.threads = [...hud.threads, { ...anchor, id, messages: [message], page: '/', status: 'open' }];
  hud.select(id);
});
host?.addEventListener('hud:reply', ({ detail: { id, text } }) => {
  update(id, (thread) => ({ messages: [...thread.messages, { at: now(), author: 'user', text }] }));
});
host?.addEventListener('hud:resolve', ({ detail: { id } }) => {
  update(id, () => ({ status: 'resolved' }));
});
host?.addEventListener('hud:anchor', ({ detail: { id, ...anchor } }) => {
  update(id, () => anchor);
});

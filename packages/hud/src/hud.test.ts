import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterAll, beforeAll, beforeEach, expect, spyOn, test } from 'bun:test';
import {
  type Hud,
  type Thread,
  glyph,
  mount,
  pinOf,
  placeOf,
  resolve,
  selectorFor,
  unique,
  visible,
} from './index.js';

const fixture = `<main><h1 id="top">a</h1><p>b</p><p id="dup">c</p><p id="dup">d</p></main>
  <section><p style="display: none">e</p><input><div contenteditable="true"></div></section><hud></hud>`;

beforeAll(() => {
  GlobalRegistrator.register({ url: 'http://localhost/' });
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});
beforeEach(() => {
  const parser = new DOMParser();
  document.body.replaceChildren(...parser.parseFromString(fixture, 'text/html').body.childNodes);
});

const query = (selector: string): HTMLElement => document.querySelector<HTMLElement>(selector)!;
const box = (element: Element, rect: DOMRect): void => {
  element.getBoundingClientRect = (): DOMRect => rect;
};
const frame = async (): Promise<void> => {
  await new Promise((done) => {
    setTimeout(done, 20);
  });
};
const key = (init: KeyboardEventInit, element: Element = document.body): boolean =>
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, ...init }));
const pointer = (type: string, element: Element, at = 0): boolean =>
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: at,
      clientY: at,
      composed: true,
    }),
  );
const label = (pin: Element): string | null => pin.getAttribute('aria-label');
const lit = (image: SVGSVGElement): number =>
  image.querySelector('path')!.getAttribute('d')!.split('M').length - 1;
const size = (image: SVGSVGElement): (string | null)[] =>
  ['viewBox', 'width', 'height'].map((name) => image.getAttribute(name));
const thread = (
  id: string,
  selector: string,
  { page = '/', status = 'open' }: Partial<Thread> = {},
): Thread => ({
  id,
  messages: [{ at: '2026-10-22T00:00:00Z', author: 'agent', text: `on ${id}` }],
  page,
  selector,
  status,
  x: 50,
  y: 50,
});
const setup = (threads: Thread[] = []): { hud: Hud; seen: unknown[][]; shadow: ShadowRoot } => {
  const hud = mount(undefined, { threads });
  const seen: unknown[][] = [];
  for (const name of [
    'hud:anchor',
    'hud:open',
    'hud:reopen',
    'hud:reply',
    'hud:resolve',
    'hud:select',
  ] as const) {
    query('hud').addEventListener(name, (event) => {
      seen.push([name, event.detail]);
    });
  }
  return { hud, seen, shadow: query('hud > div').shadowRoot! };
};

test('selectorFor grows a short unique selector', () => {
  const paragraphs = document.querySelectorAll('p');
  expect(selectorFor(query('h1'))).toBe('#top');
  expect(selectorFor(query('main'))).toBe('main');
  expect(selectorFor(paragraphs[0]!)).toBe('main > p:nth-of-type(1)');
  expect(selectorFor(paragraphs[2]!)).toBe('p:nth-of-type(3)');
  expect(selectorFor(query('section p'))).toBe('section > p:nth-of-type(1)');
  expect(selectorFor(document.createElement('i'))).toBe('i:nth-of-type(1)');
});

test('resolve, unique, visible', () => {
  expect(resolve('#top')).toBe(query('h1'));
  expect(resolve('h1', query('section'))).toBeUndefined();
  expect(resolve('[')).toBeUndefined();
  expect([unique('#top'), unique('#dup'), unique('main', query('main'))]).toEqual([
    true,
    false,
    false,
  ]);
  expect([visible(query('h1')), visible(query('section p'))]).toEqual([true, false]);
});

test('pinOf and placeOf convert between client points and box percentages', () => {
  box(query('h1'), new DOMRect(10, 20, 200, 100));
  expect(pinOf(query('h1'), 60, 45)).toEqual({ x: 25, y: 25 });
  expect(pinOf(query('h1'), -5, 500)).toEqual({ x: 0, y: 100 });
  expect(pinOf(query('p'), 3, 3)).toEqual({ x: 100, y: 100 });
  expect(placeOf(query('h1'), { x: 25, y: 25 })).toEqual({ left: 60, top: 45 });
});

test('mount needs a <hud> and leaves nothing behind', () => {
  query('hud').remove();
  expect(() => mount()).toThrow('no <hud>');
  const host = document.createElement('hud');
  document.body.append(host);
  const hud = mount(host, { page: '/x' });
  expect([hud.page, hud.threads, host.children.length]).toEqual(['/x', [], 1]);
  hud.destroy();
  expect(host.children.length).toBe(0);
  key({ key: 'c' });
});

test('the picker opens a compose popover and submits hud:open', () => {
  const { seen, shadow } = setup();
  const outline = shadow.querySelector<HTMLElement>('#box')!;
  const click = (init: MouseEventInit = {}): boolean =>
    query('h1').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, ...init }),
    );
  box(query('h1'), new DOMRect(0, 0, 100, 40));
  for (const init of [{ key: 'c', metaKey: true }, { key: 'c', repeat: true }, { key: 'x' }]) {
    key(init);
  }
  key({ key: 'c' }, query('input'));
  key({ key: 'c' }, query('[contenteditable]'));
  pointer('pointermove', query('h1'));
  expect(outline.hidden).toBe(true);
  key({ key: 'c' });
  pointer('pointermove', query('h1'));
  expect([outline.hidden, outline.style.width]).toEqual([false, '100px']);
  pointer('pointermove', query('hud'));
  expect(outline.hidden).toBe(true);
  key({ key: 'Escape' });
  key({ key: 'Escape' });
  expect(click()).toBe(true);
  key({ key: 'c' });
  key({ key: 'c' });
  key({ key: 'c' });
  query('hud').click();
  expect(click({ clientX: 25, clientY: 10 })).toBe(false);
  const area = shadow.querySelector('textarea')!;
  key({ key: 'Enter' }, area);
  key({ key: 'Enter', shiftKey: true }, area);
  area.value = ' looks off ';
  key({ key: 'c' }, area);
  key({ key: 'Enter' }, area);
  expect(seen).toEqual([['hud:open', { selector: '#top', text: 'looks off', x: 25, y: 25 }]]);
  expect(shadow.querySelector('#compose')).toBeNull();
  key({ key: 'c' });
  click();
  key({ key: 'Escape' }, shadow.querySelector('textarea')!);
  expect(shadow.querySelector('#compose')).toBeNull();
});

test('picking sets a crosshair; a click drafts the next pin until the thread arrives', () => {
  const { style } = document.documentElement;
  style.cursor = 'help';
  const threads = [thread('a', '#top'), thread('r', 'p', { status: 'resolved' })];
  const { hud, shadow } = setup(threads);
  const cursors: string[] = [];
  const draft = (): HTMLElement | undefined =>
    shadow.querySelector<HTMLElement>('[data-draft="true"]') ?? undefined;
  const pickH1 = (): void => {
    hud.pick();
    cursors.push(style.cursor);
    query('h1').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 25, clientY: 10 }));
    cursors.push(style.cursor);
  };
  box(query('h1'), new DOMRect(0, 0, 100, 40));
  hud.pick();
  key({ key: 'Escape' });
  cursors.push(style.cursor);
  hud.pick();
  pickH1();
  expect([label(draft()!), draft()!.style.left, draft()!.style.top]).toEqual(['2', '25px', '10px']);
  key({ key: 'Escape' }, shadow.querySelector('[placeholder="comment"]')!);
  expect(draft()).toBeUndefined();
  pickH1();
  const area = shadow.querySelector<HTMLTextAreaElement>('[placeholder="comment"]')!;
  area.value = 'here';
  key({ key: 'Enter' }, area);
  expect(draft()).toBeDefined();
  hud.threads = [...threads, thread('b', '#top')];
  expect([
    draft(),
    ...[...shadow.querySelectorAll('button[data-status]')].map((button) => label(button)),
  ]).toEqual([undefined, '1', '2', '✓']);
  hud.pick();
  hud.destroy();
  expect([...cursors, style.cursor]).toEqual([
    'help',
    'crosshair',
    'help',
    'crosshair',
    'help',
    'help',
  ]);
});

test('pins, panel, reply, resolve, re-anchor', async () => {
  const threads = [
    thread('r', 'p', { status: 'resolved' }),
    thread('a', '#top'),
    thread('gone', '#nope'),
    thread('hidden', 'section p'),
    thread('else', '#top', { page: '/other' }),
  ];
  const { hud, seen, shadow } = setup(threads);
  const pins = (): HTMLElement[] => [
    ...shadow.querySelectorAll<HTMLElement>('button[data-status]'),
  ];
  const [pin] = pins();
  const drop = spyOn(document, 'elementFromPoint');
  const drag = (to: number): void => {
    pointer('pointerdown', pins()[0]!);
    pointer('pointermove', document.body, to);
    pointer('pointerup', document.body, to);
  };
  expect(pins().map((button) => [label(button), button.hidden])).toEqual([
    ['1', false],
    ['2', true],
    ['3', true],
    ['✓', false],
  ]);
  box(query('h1'), new DOMRect(0, 100, 100, 40));
  query('h1').append('!');
  await frame();
  expect([pin!.style.left, pin!.style.top]).toEqual(['50px', '120px']);
  pin!.click();
  expect(shadow.querySelector('aside')!.hidden).toBe(false);
  shadow.querySelectorAll('header')[1]!.click();
  const reply = shadow.querySelector('textarea')!;
  reply.value = 'done';
  key({ key: 'Enter' }, reply);
  key({ key: 'Escape' }, reply);
  reply.focus();
  shadow.querySelector<HTMLElement>('button:not([data-id])')!.click();
  box(query('main p'), new DOMRect(0, 0, 10, 10));
  drop.mockReturnValue(query('main p'));
  drag(1);
  drag(5);
  drop.mockReturnValue(query('hud > div'));
  drag(9);
  drop.mockRestore();
  expect(shadow.activeElement).toBe(reply);
  expect(seen).toEqual([
    ['hud:select', { id: 'a' }],
    ['hud:select', { id: 'a' }],
    ['hud:reply', { id: 'a', text: 'done' }],
    ['hud:resolve', { id: 'a' }],
    ['hud:select', { id: 'a' }],
    ['hud:anchor', { id: 'a', selector: 'main > p:nth-of-type(1)', x: 50, y: 50 }],
  ]);
  shadow.querySelector('header')!.click();
  shadow.querySelector<HTMLElement>('button[data-id=""]')!.click();
  expect(shadow.querySelector('aside')!.hidden).toBe(true);
  hud.select('r');
  expect(label(shadow.querySelector('[data-on="true"]')!)).toBe('✓');
  [...shadow.querySelectorAll('button')].find((button) => button.textContent === 'reopen')!.click();
  expect(seen.slice(-2)).toEqual([
    ['hud:reopen', { id: 'r' }],
    ['hud:select', { id: 'r' }],
  ]);
  hud.page = '/other';
  hud.threads = [...threads, thread('b', 'p', { page: '/other' })];
  expect([hud.page, hud.threads.length, pins().map((button) => label(button))]).toEqual([
    '/other',
    6,
    ['1', '2'],
  ]);
  hud.pick();
  hud.destroy();
});

test('glyph draws pixel-grid digits and a check as one path of unit squares', () => {
  expect(Array.from('0123456789', (digit) => lit(glyph(digit)))).toEqual([
    12, 8, 11, 11, 9, 11, 12, 7, 13, 12,
  ]);
  expect(glyph('1').querySelector('path')!.getAttribute('d')).toStartWith('M1 0h1v1h-1z');
  expect(size(glyph('7'))).toEqual(['0 0 3 5', '6', '10']);
  expect(size(glyph('12'))).toEqual(['0 0 7 5', '14', '10']);
  expect(glyph('12').querySelector('path')!.getAttribute('d')).toContain('M4 0h1v1h-1z');
  expect([lit(glyph('✓')), ...size(glyph('✓'))]).toEqual([5, '0 0 5 4', '10', '8']);
  expect([lit(glyph('x')), ...size(glyph('x'))]).toEqual([0, '0 0 0 0', '0', '0']);
});

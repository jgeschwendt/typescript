import { pinOf, placeOf, resolve, selectorFor, visible } from './anchor.js';
import { glyph } from './glyph.js';
import { css } from './style.js';

interface Message {
  at: string;
  author: 'agent' | 'user';
  text: string;
}

interface Thread {
  id: string;
  messages: Message[];
  page: string;
  selector: string;
  status: 'open' | 'resolved';
  x: number;
  y: number;
}

/**
Each `hud:<name>` event's `detail`, dispatched on the `<hud>` host, bubbling and composed.
*/
interface HudEvents {
  anchor: { id: string; selector: string; x: number; y: number };
  open: { selector: string; text: string; x: number; y: number };
  reopen: { id: string };
  reply: { id: string; text: string };
  resolve: { id: string };
  select: { id: string };
}

type HudEventMap = { [Name in keyof HudEvents as `hud:${Name}`]: CustomEvent<HudEvents[Name]> };

declare global {
  interface ElementEventMap extends HudEventMap {}
}

interface Hud {
  destroy: () => void;
  page: string;
  pick: () => void;
  select: (id: string) => void;
  threads: Thread[];
}

interface Options {
  page?: string;
  threads?: Thread[];
}

interface Layer {
  box: HTMLElement;
  close?: () => void;
  cursor: string;
  frame: number;
  host: Element;
  isPicking: boolean;
  page: string;
  panel: HTMLElement;
  pins: HTMLElement;
  placed: Map<HTMLElement, Pick<Thread, 'selector' | 'x' | 'y'>>;
  replies: Map<string, HTMLTextAreaElement>;
  selected?: string;
  shadow: ShadowRoot;
  threads: Thread[];
}

// a press travels this many pixels before it is a drag
const dragSlop = 3;
// the compose popover's footprint, kept inside the viewport
const composeHeight = 100;
const composeWidth = 268;
const editableTags = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

const create = <Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  properties: Partial<HTMLElementTagNameMap[Tag]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[Tag] => {
  const element = Object.assign(document.createElement(tag), properties);
  element.append(...children);
  return element;
};

const emit = <Name extends keyof HudEvents>(
  layer: Layer,
  name: Name,
  detail: HudEvents[Name],
): void => {
  layer.host.dispatchEvent(
    new CustomEvent(`hud:${name}`, { bubbles: true, composed: true, detail }),
  );
};

const moveTo = (element: HTMLElement, left: number, top: number): void => {
  Object.assign(element.style, { left: `${left}px`, top: `${top}px` });
};

const origin = (layer: Layer): { left: number; top: number } => placeOf(layer.pins, { x: 0, y: 0 });

const isEditable = (target: EventTarget | undefined): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || editableTags.has(target.tagName));

const field = (
  placeholder: string,
  submit: (text: string) => void,
  cancel?: () => void,
): HTMLTextAreaElement => {
  const area = create('textarea', { placeholder, rows: 2 });
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      cancel?.();
    }
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    const text = area.value.trim();
    area.value = '';
    if (text) {
      submit(text);
    }
  });
  return area;
};

// a pin labelled by its pixel-grid glyph, no font involved
const pinButton = (label: string): HTMLButtonElement => {
  const button = create('button', {}, glyph(label));
  button.setAttribute('aria-label', label);
  return button;
};

const place = (layer: Layer): void => {
  const { left, top } = origin(layer);
  for (const [pin, thread] of layer.placed) {
    const element = resolve(thread.selector);
    pin.hidden = !element || !visible(element);
    if (!element || pin.hidden) {
      continue;
    }
    const at = placeOf(element, thread);
    // whole pixels, so the glyph's cells land on the device grid
    moveTo(pin, Math.round(at.left - left), Math.round(at.top - top));
  }
};

const drag = (layer: Layer, down: PointerEvent, [pin, thread]: [HTMLElement, Thread]): void => {
  const controller = new AbortController();
  const { signal } = controller;
  let hasMoved = false;
  document.addEventListener(
    'pointermove',
    (event) => {
      hasMoved ||=
        Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > dragSlop;
      pin.dataset['drag'] = String(hasMoved);
      const { left, top } = origin(layer);
      moveTo(pin, event.clientX + scrollX - left, event.clientY + scrollY - top);
    },
    { signal },
  );
  document.addEventListener(
    'pointerup',
    (event) => {
      const target = hasMoved ? document.elementFromPoint(event.clientX, event.clientY) : undefined;
      controller.abort();
      pin.dataset['drag'] = 'false';
      if (target && !layer.host.contains(target)) {
        emit(layer, 'anchor', {
          id: thread.id,
          selector: selectorFor(target),
          ...pinOf(target, event.clientX, event.clientY),
        });
      }
      place(layer);
    },
    { signal },
  );
};

const marked = <Marked extends HTMLElement>(
  layer: Layer,
  element: Marked,
  thread: Thread,
): Marked => {
  Object.assign(element.dataset, {
    id: thread.id,
    on: String(thread.id === layer.selected),
    status: thread.status,
  });
  return element;
};

const renderThread = (layer: Layer, thread: Thread, label: string): HTMLElement => {
  const reply =
    layer.replies.get(thread.id) ??
    field('reply', (text) => {
      emit(layer, 'reply', { id: thread.id, text });
    });
  layer.replies.set(thread.id, reply);
  const action = thread.status === 'open' ? 'resolve' : 'reopen';
  const toggle = create('button', {
    onclick: () => {
      emit(layer, action, { id: thread.id });
    },
    textContent: action,
  });
  const messages = thread.messages.map((message) =>
    create('p', { title: message.at }, create('b', { textContent: message.author }), message.text),
  );
  const actions = create('div', {}, ...(action === 'resolve' ? [reply] : []), toggle);
  return marked(
    layer,
    create('section', {}, create('header', { textContent: label }), ...messages, actions),
    thread,
  );
};

const order = (layer: Layer): { label: (thread: Thread) => string; ordered: Thread[] } => {
  const mine = layer.threads.filter((thread) => thread.page === layer.page);
  const open = mine.filter((thread) => thread.status === 'open');
  return {
    label: (thread) => (thread.status === 'open' ? String(open.indexOf(thread) + 1) : '✓'),
    ordered: [...open, ...mine.filter((thread) => thread.status !== 'open')],
  };
};

const renderPanel = (layer: Layer, { label, ordered }: ReturnType<typeof order>): void => {
  const close = create('button', { textContent: '×', title: 'close' });
  close.dataset['id'] = '';
  layer.panel.hidden = layer.selected === undefined;
  layer.panel.replaceChildren(
    create('header', {}, 'threads', close),
    ...ordered.map((thread) => renderThread(layer, thread, `${label(thread)} ${thread.status}`)),
  );
};

const render = (layer: Layer): void => {
  const { activeElement } = layer.shadow;
  const sorted = order(layer);
  const pin = (thread: Thread): HTMLElement => {
    const button = pinButton(sorted.label(thread));
    button.addEventListener('pointerdown', (event) => {
      drag(layer, event, [button, thread]);
    });
    return marked(layer, button, thread);
  };
  layer.placed = new Map(sorted.ordered.map((thread) => [pin(thread), thread]));
  layer.pins.replaceChildren(...layer.placed.keys());
  renderPanel(layer, sorted);
  if (activeElement instanceof HTMLElement) {
    activeElement.focus();
  }
  place(layer);
};

const select = (layer: Layer, id: string): void => {
  layer.selected = id || undefined;
  render(layer);
  layer.pins
    .querySelector(`[data-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const onSelect = (layer: Layer, { target }: Event): void => {
  const id =
    target instanceof Element ? target.closest<HTMLElement>('[data-id]')?.dataset['id'] : undefined;
  if (id === undefined) {
    return;
  }
  select(layer, id);
  if (id) {
    emit(layer, 'select', { id });
  }
};

const stopPicking = (layer: Layer): void => {
  layer.isPicking = false;
  layer.box.hidden = true;
  document.documentElement.style.cursor = layer.cursor;
};

const pick = (layer: Layer): void => {
  layer.close?.();
  if (!layer.isPicking) {
    layer.cursor = document.documentElement.style.cursor;
  }
  layer.isPicking = true;
  document.documentElement.style.cursor = 'crosshair';
};

const pickable = (layer: Layer, { target }: Event): Element | undefined =>
  layer.isPicking && target instanceof Element && !layer.host.contains(target) ? target : undefined;

const onKey = (layer: Layer, event: KeyboardEvent): void => {
  if (event.key === 'Escape' && layer.isPicking) {
    stopPicking(layer);
    return;
  }
  const [target] = event.composedPath();
  if (
    event.key !== 'c' ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    isEditable(target)
  ) {
    return;
  }
  (layer.isPicking ? stopPicking : pick)(layer);
};

const onHover = (layer: Layer, event: PointerEvent): void => {
  const target = pickable(layer, event);
  layer.box.hidden = !target;
  if (!target) {
    return;
  }
  const { height, left, top, width } = target.getBoundingClientRect();
  moveTo(layer.box, left, top);
  Object.assign(layer.box.style, { height: `${height}px`, width: `${width}px` });
};

/**
A hollow pin numbered as the next open thread, standing in until render replaces it with the real one.
*/
const drafted = (layer: Layer, at: Pick<Thread, 'selector' | 'x' | 'y'>): HTMLElement => {
  const draft = pinButton(String(layer.pins.querySelectorAll('[data-status="open"]').length + 1));
  draft.dataset['draft'] = 'true';
  layer.placed.set(draft, at);
  layer.pins.append(draft);
  place(layer);
  return draft;
};

const openCompose = (layer: Layer, target: Element, { clientX, clientY }: MouseEvent): void => {
  const at = { selector: selectorFor(target), ...pinOf(target, clientX, clientY) };
  const draft = drafted(layer, at);
  const compose = create('div', { id: 'compose' });
  layer.close = (): void => {
    compose.remove();
    draft.remove();
  };
  const area = field(
    'comment',
    (text) => {
      compose.remove();
      emit(layer, 'open', { ...at, text });
    },
    layer.close,
  );
  compose.append(area, create('small', { textContent: 'enter to send · esc to cancel' }));
  moveTo(
    compose,
    Math.min(clientX, innerWidth - composeWidth),
    Math.min(clientY, innerHeight - composeHeight),
  );
  layer.shadow.append(compose);
  area.focus();
};

const onPick = (layer: Layer, event: MouseEvent): void => {
  const target = pickable(layer, event);
  if (!target) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  stopPicking(layer);
  openCompose(layer, target, event);
};

const listen = (layer: Layer, signal: AbortSignal): void => {
  const options = { capture: true, signal };
  document.addEventListener(
    'keydown',
    (event) => {
      onKey(layer, event);
    },
    options,
  );
  document.addEventListener(
    'pointermove',
    (event) => {
      onHover(layer, event);
    },
    options,
  );
  document.addEventListener(
    'click',
    (event) => {
      onPick(layer, event);
    },
    options,
  );
  layer.shadow.addEventListener('click', (event) => {
    onSelect(layer, event);
  });
};

const observe = (layer: Layer, signal: AbortSignal): void => {
  const schedule = (): void => {
    layer.frame ||= requestAnimationFrame(() => {
      layer.frame = 0;
      place(layer);
    });
  };
  const resize = new ResizeObserver(schedule);
  const mutation = new MutationObserver(schedule);
  resize.observe(document.documentElement);
  mutation.observe(document.body, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  addEventListener('scroll', schedule, { capture: true, signal });
  addEventListener('resize', schedule, { signal });
  signal.addEventListener('abort', () => {
    resize.disconnect();
    mutation.disconnect();
    cancelAnimationFrame(layer.frame);
  });
};

const createLayer = (
  host: Element,
  shadow: ShadowRoot,
  { page, threads }: Required<Options>,
): Layer => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  shadow.adoptedStyleSheets = [sheet];
  const layer: Layer = {
    box: create('div', { hidden: true, id: 'box' }),
    cursor: '',
    frame: 0,
    host,
    isPicking: false,
    page,
    panel: create('aside', { hidden: true }),
    pins: create('div', { id: 'pins' }),
    placed: new Map(),
    replies: new Map(),
    shadow,
    threads,
  };
  shadow.append(layer.pins, layer.box, layer.panel);
  return layer;
};

/**
Render the layer into `host` (default: the page's `<hud>`) and return its handle.
*/
const mount = (
  host = document.querySelector('hud'),
  { page = location.pathname, threads = [] }: Options = {},
): Hud => {
  if (!host) {
    throw new Error('@jlg/hud: no <hud> element to mount into');
  }
  const root = create('div');
  host.append(root);
  const layer = createLayer(host, root.attachShadow({ mode: 'open' }), { page, threads });
  const controller = new AbortController();
  listen(layer, controller.signal);
  observe(layer, controller.signal);
  render(layer);
  return {
    destroy: () => {
      if (layer.isPicking) {
        stopPicking(layer);
      }
      controller.abort();
      root.remove();
    },
    get page() {
      return layer.page;
    },
    set page(value) {
      layer.page = value;
      render(layer);
    },
    pick: () => {
      pick(layer);
    },
    select: (id) => {
      select(layer, id);
    },
    get threads() {
      return layer.threads;
    },
    set threads(value) {
      layer.threads = value;
      render(layer);
    },
  };
};

export { type Hud, type HudEvents, type Message, mount, type Options, type Thread };

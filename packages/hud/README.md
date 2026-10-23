# @jlg/hud

A heads-up layer a page mounts once to leave comment threads pinned to its elements. Zero dependencies, no framework: data in, events out, no transport inside.

## Install

Not published to npm. Inside this workspace, depend on `"@jlg/hud": "workspace:*"` and `bun run build` the package (ESM plus declarations in `dist/`).

## Mount

```html
<hud></hud>
```

```ts
import { mount } from '@jlg/hud';

const hud = mount(); // the page's <hud>, or mount(element, { page, threads })
hud.threads = await load(); // setting threads or page re-renders
```

`<hud>` is a plain element, not a custom element: a custom element name needs a hyphen, and `attachShadow` is refused on an unknown element. `mount(el = document.querySelector('hud'), { page = location.pathname, threads = [] })` throws without one, renders into an inner `<div>` that owns a shadow root styled by a constructed stylesheet — so the page's CSS stays out and a CSP without `'unsafe-inline'` styles still works — and returns the handle. Nothing registers globally, nothing runs on import.

| handle            | does                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `threads`, `page` | get, or set and re-render                                               |
| `pick()`          | start the picker                                                        |
| `select(id)`      | open the panel on a thread and scroll its pin into view; `''` closes it |
| `destroy()`       | remove the layer and every listener and observer                        |

Press `c` (outside inputs, textareas, contenteditable) or call `pick()`: the cursor turns to a crosshair and the element under it is outlined, Escape cancels, a click drops a hollow draft pin numbered as the next thread and opens a compose box — Enter sends, Shift+Enter breaks the line, Escape cancels and drops the draft, which the real pin replaces once the host sets `threads`. Pins for the current `page` sit where their selector resolves (none when it resolves to nothing or a hidden element), follow resize, scroll and DOM changes, and drag to re-anchor. An open pin shows its 1-based place among the page's open threads, a resolved one a dimmed check, both drawn by `glyph` as pixel-grid SVG rather than a font, centred on whole pixels. Clicking a pin opens the panel: the page's threads, open first, each with its messages; an open one carries a reply box and a resolve button, a resolved one a reopen button.

## Events

Dispatched on the `<hud>` element as bubbling, composed `CustomEvent`s; the host answers by setting `threads`.

| event         | `detail`                   | when                       |
| ------------- | -------------------------- | -------------------------- |
| `hud:open`    | `{ selector, x, y, text }` | a new comment is sent      |
| `hud:reply`   | `{ id, text }`             | a reply is sent            |
| `hud:resolve` | `{ id }`                   | resolve is clicked         |
| `hud:reopen`  | `{ id }`                   | reopen is clicked          |
| `hud:anchor`  | `{ id, selector, x, y }`   | a pin is dropped           |
| `hud:select`  | `{ id }`                   | a pin or thread is clicked |

## Thread

```ts
interface Thread {
  id: string;
  messages: { at: string; author: 'agent' | 'user'; text: string }[];
  page: string;
  selector: string;
  status: 'open' | 'resolved';
  x: number; // percent of the anchored element's width
  y: number; // percent of its height
}
```

## Utils

| export                               | returns                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `selectorFor(el)`                    | a selector unique in `el`'s document: `#id`, the tag, or `tag:nth-of-type`, grown up the tree            |
| `resolve(selector, root = document)` | the matching element, or `undefined` (an invalid selector too)                                           |
| `unique(selector, root = document)`  | whether exactly one element matches                                                                      |
| `pinOf(el, clientX, clientY)`        | `{ x, y }` percentages of the point in `el`'s box, clamped to 0–100                                      |
| `placeOf(el, { x, y })`              | `{ left, top }` document coordinates of that pin                                                         |
| `visible(el)`                        | whether `el` renders                                                                                     |
| `glyph(text)`                        | an `<svg>` of `text`: digits as 3×5 bitmaps, `✓` as 5×4, 2px cells one cell apart, filled `currentColor` |

## Theming

Set on `<hud>`; each falls back to the dark default.

| variable       | default                                |
| -------------- | -------------------------------------- |
| `--hud-accent` | `#8fb3e8`                              |
| `--hud-bg`     | `#07080a`                              |
| `--hud-fg`     | `#c9ccd1`                              |
| `--hud-font`   | `ui-sans-serif, system-ui, sans-serif` |
| `--hud-line`   | `#1d2025`                              |
| `--hud-muted`  | `#6b7079`                              |

## Demo

`bun run demo` serves a static page with the layer and an in-memory store on http://127.0.0.1:4173/.

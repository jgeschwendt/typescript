const css = `
:host {
  all: initial;
  --accent: var(--hud-accent, #8fb3e8);
  --bg: var(--hud-bg, #07080a);
  --fg: var(--hud-fg, #c9ccd1);
  --line: var(--hud-line, #1d2025);
  --muted: var(--hud-muted, #6b7079);
  color: var(--fg);
  font: 12px/1.5 var(--hud-font, ui-sans-serif, system-ui, sans-serif);
  left: 0;
  position: absolute;
  top: 0;
  z-index: 2147483647;
}
[hidden] { display: none !important; }
button, textarea { background: none; border: 0; color: inherit; font: inherit; padding: 0; }
button { cursor: pointer; }
#pins { left: 0; position: absolute; top: 0; }
#pins button {
  align-items: center;
  background: var(--accent);
  border: 1px solid var(--bg);
  border-radius: 10px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.5);
  box-sizing: border-box;
  color: var(--bg);
  cursor: grab;
  display: flex;
  height: 20px;
  justify-content: center;
  min-width: 20px;
  padding: 0 6px;
  position: absolute;
  transform: translate(-50%, -50%);
}
#pins svg { fill: currentColor; flex: none; shape-rendering: crispEdges; }
#pins [data-status="resolved"] { opacity: 0.35; padding: 0; }
#pins [data-on="true"] { outline: 1px solid var(--accent); outline-offset: 2px; }
#pins [data-drag="true"] { cursor: grabbing; pointer-events: none; }
#pins [data-draft="true"] { background: var(--bg); border-color: var(--accent); color: var(--accent); pointer-events: none; }
#box {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 1px solid var(--accent);
  pointer-events: none;
  position: fixed;
}
#compose, aside { background: var(--bg); border: 1px solid var(--line); box-sizing: border-box; position: fixed; }
#compose { border-radius: 6px; box-shadow: 0 4px 16px rgb(0 0 0 / 0.5); padding: 8px; width: 260px; }
aside { border-width: 0 0 0 1px; bottom: 0; overflow: auto; right: 0; top: 0; width: 320px; }
aside > header { background: var(--bg); border-bottom: 1px solid var(--line); color: var(--muted); display: flex; justify-content: space-between; padding: 10px 12px; position: sticky; top: 0; }
section { border-bottom: 1px solid var(--line); cursor: pointer; padding: 10px 12px; }
section[data-on="true"] { box-shadow: inset 2px 0 var(--accent); cursor: auto; }
section[data-status="resolved"] { opacity: 0.5; }
section header { color: var(--muted); margin-bottom: 6px; }
p { margin: 0 0 6px; white-space: pre-wrap; }
b { color: var(--muted); font-weight: 400; margin-right: 6px; }
textarea { border: 1px solid var(--line); border-radius: 4px; box-sizing: border-box; cursor: text; display: block; outline: 0; padding: 6px; resize: vertical; width: 100%; }
textarea:focus { border-color: var(--accent); }
section button, small { color: var(--muted); display: block; font-size: 11px; margin-top: 4px; }
button:hover { color: var(--fg); }
`;

export { css };

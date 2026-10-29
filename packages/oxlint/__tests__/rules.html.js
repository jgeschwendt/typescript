// ui.css vendored from jgeschwendt/ui @ 162e78b
import { rows } from './rules.js';

const html = new URL('rules.html', import.meta.url);
await Bun.write(
  html,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>@jlg/oxlint rules</title>
    <link rel="stylesheet" href="ui.css" />
    <style>
      header {
        background: var(--ui-bg);
        padding-block: var(--ui-space-4);
        position: sticky;
        top: 0;
        /* above the muted rows: opacity stacks them like positioned boxes */
        z-index: 1;
      }
      th,
      .is-set {
        cursor: pointer;
        user-select: none;
      }
      th[data-dir]::after {
        content: attr(data-dir);
        padding-left: var(--ui-space-1);
      }
      .is-muted {
        opacity: 0.55;
      }
      /* the table scrolls sideways inside .table-wrap; only the reason wraps */
      td {
        white-space: nowrap;
      }
      td.muted {
        min-width: 32ch;
        white-space: normal;
      }
    </style>
  </head>
  <body class="ui">
    <main data-container>
      <header class="stack">
        <div class="row">
          <h1 class="h1">@jlg/oxlint rules</h1>
          <output id="count" class="badge"></output>
        </div>
        <div id="filters" class="row">
          <label class="field">
            <span class="label">rule</span>
            <input id="filter" class="input input-sm" type="search" placeholder="filter rules and reasons" autofocus />
          </label>
        </div>
      </header>
      <div class="table-wrap">
        <table data-table class="table-hover table-mono">
          <thead>
            <tr id="head"></tr>
          </thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    </main>
    <script id="rows" type="application/json">
      ${JSON.stringify(rows)}
    </script>
    <script>
      const rows = JSON.parse(document.querySelector('#rows').textContent);
      const columns = ['rule', 'category', 'oxlint', 'type-aware', 'base', 'options', 'reason'];
      const pills = {
        error: 'danger',
        js: 'info',
        native: 'ok',
        none: 'ok',
        set: 'info',
        warn: 'warn',
        yes: 'info',
      };
      const filter = document.querySelector('#filter');
      const head = document.querySelector('#head');
      /** rules whose detail row is open */
      const open = new Set();
      let [sort, dir] = [0, 1];
      const el = (tag, props, ...children) => {
        const node = Object.assign(document.createElement(tag), props);
        node.append(...children);
        return node;
      };
      const selects = columns.slice(1, -1).map((name) => {
        const select = el(
          'select',
          { className: 'select select-sm', oninput: render },
          ...['any', ...new Set(rows.map((row) => row[name]).sort())].map((value) => new Option(value)),
        );
        document.querySelector('#filters').append(el('label', { className: 'field' }, el('span', { className: 'label', textContent: name }), select));
        return select;
      });
      head.append(
        ...columns.map((name, index) =>
          el('th', {
            onclick: () => {
              [sort, dir] = [index, sort === index ? -dir : 1];
              render();
            },
            textContent: name,
          }),
        ),
      );
      const cell = (row, name) =>
        el(
          'td',
          { className: name === 'reason' ? 'muted' : '' },
          row.options === 'set' && name === 'options' ? (open.has(row.rule) ? '▾ ' : '▸ ') : '',
          name === 'rule' && row.url
            ? el('a', { className: 'link', href: row.url, textContent: row.rule })
            : ['reason', 'rule'].includes(name) || row[name] === '-'
            ? row[name]
            : el('span', {
                className: \`pill \${pills[row[name]] ? \`pill-\${pills[row[name]]}\` : ''}\`,
                textContent: row[name],
              }),
        );
      const detail = (row) =>
        el('tr', {}, el('td', { colSpan: columns.length }, el('pre', { className: 'readout', textContent: JSON.stringify(row.baseOptions, undefined, 2) })));
      function render() {
        const query = filter.value.trim().toLowerCase();
        const shown = rows
          .filter(
            (row) =>
              [row.rule, row.reason].some((text) => text.toLowerCase().includes(query)) &&
              selects.every((select, index) => select.value === 'any' || row[columns[index + 1]] === select.value),
          )
          .sort((a, b) => dir * a[columns[sort]].localeCompare(b[columns[sort]]) || a.rule.localeCompare(b.rule));
        document.querySelector('#body').replaceChildren(
          ...shown.flatMap((row) => {
            const tr = el('tr', { className: row.oxlint === 'none' || row.base === 'off' ? 'is-muted' : '' }, ...columns.map((name) => cell(row, name)));
            if (row.options !== 'set') {
              return [tr];
            }
            tr.classList.add('is-set');
            tr.onclick = () => {
              open.delete(row.rule) || open.add(row.rule);
              render();
            };
            return open.has(row.rule) ? [tr, detail(row)] : [tr];
          }),
        );
        [...head.children].forEach((th, index) =>
          index === sort ? (th.dataset.dir = dir > 0 ? '▲' : '▼') : delete th.dataset.dir,
        );
        document.querySelector('#count').textContent = \`\${shown.length} of \${rows.length}\`;
      }
      filter.addEventListener('input', render);
      render();
    </script>
  </body>
</html>
`,
);
// oxfmt reflows the embedded rows: formatting here keeps a regenerate diff-clean
Bun.spawnSync([process.execPath, 'x', 'oxfmt', Bun.fileURLToPath(html)]);

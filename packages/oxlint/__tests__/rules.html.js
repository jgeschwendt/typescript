// regenerate after every snapshot change: bun run --filter '@jlg/oxlint' report
// ui.css vendored from jgeschwendt/ui @ 162e78b
import { rows } from './rules.js';

const reasons = [...new Set(rows.flatMap(({ reason }) => reason ?? []))]
  .toSorted()
  .map(
    (reason) =>
      `<output class="badge badge-warn">${rows.filter((row) => row.reason === reason).length} ${reason}</output>`,
  )
  .join('');

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
      .is-differs {
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
    </style>
  </head>
  <body class="ui">
    <main data-container>
      <header class="stack">
        <div class="row">
          <h1 class="h1">@jlg/oxlint rules</h1>
          <output id="count" class="badge"></output>
          ${reasons}
        </div>
        <p class="muted">
          Old and base options are resolved over the rule's declared defaults as ESLint does and compared over the
          keys the rule knows; <code class="code">unverified</code> marks an old key its schema no longer has, or a
          bare base where the rule declares no defaults, so no difference is claimed.
        </p>
        <div id="filters" class="row">
          <label class="field">
            <span class="label">rule</span>
            <input id="filter" class="input input-sm" type="search" placeholder="filter rules" autofocus />
          </label>
        </div>
      </header>
      <table data-table class="table-hover table-mono">
        <thead>
          <tr id="head"></tr>
        </thead>
        <tbody id="body"></tbody>
      </table>
    </main>
    <script id="rows" type="application/json">
      ${JSON.stringify(rows)}
    </script>
    <script>
      const rows = JSON.parse(document.querySelector('#rows').textContent);
      const columns = ['rule', 'category', 'old', 'oxlint', 'base', 'options'];
      const pills = {
        differs: 'warn',
        error: 'danger',
        js: 'info',
        native: 'ok',
        'native (type-aware)': 'ok',
        same: 'ok',
        warn: 'warn',
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
      /** what a filter matches: a plain value takes every reason */
      const values = (row, name) => [row[name], ...(name === 'options' && row.reason ? [\`\${row[name]}: \${row.reason}\`] : [])];
      const selects = columns.slice(1).map((name) => {
        const select = el(
          'select',
          { className: 'select select-sm', oninput: render },
          ...['any', ...new Set(rows.flatMap((row) => values(row, name)).sort())].map((value) => new Option(value)),
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
      /** a pill per value but the rule and \`-\`; a \`differs\` or \`unverified\` pill titles its reason */
      const cell = (row, name) =>
        el(
          'td',
          {},
          row.reason && name === 'options' ? (open.has(row.rule) ? '▾ ' : '▸ ') : '',
          name === 'rule' || row[name] === '-'
            ? row[name]
            : el('span', {
                className: \`pill \${pills[row[name]] ? \`pill-\${pills[row[name]]}\` : ''}\`,
                textContent: row[name],
                title: (name === 'options' && row.reason) || '',
              }),
        );
      /** old and base option arrays side by side */
      const detail = (row) => {
        const grid = el(
          'div',
          {},
          ...['old', 'base'].map((side) =>
            el(
              'div',
              { className: 'stack' },
              el('span', { className: 'label', textContent: side }),
              el('pre', { className: 'readout', textContent: JSON.stringify(row[\`\${side}Options\`], undefined, 2) }),
            ),
          ),
        );
        grid.dataset.grid = '';
        return el('tr', {}, el('td', { colSpan: columns.length }, grid));
      };
      function render() {
        const query = filter.value.trim().toLowerCase();
        const shown = rows
          .filter(
            (row) =>
              row.rule.includes(query) &&
              selects.every((select, index) => select.value === 'any' || values(row, columns[index + 1]).includes(select.value)),
          )
          .sort((a, b) => dir * a[columns[sort]].localeCompare(b[columns[sort]]) || a.rule.localeCompare(b.rule));
        document.querySelector('#body').replaceChildren(
          ...shown.flatMap((row) => {
            const tr = el('tr', { className: row.oxlint === 'none' || row.base === 'off' ? 'is-muted' : '' }, ...columns.map((name) => cell(row, name)));
            if (!row.reason) {
              return [tr];
            }
            tr.classList.add('is-differs');
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

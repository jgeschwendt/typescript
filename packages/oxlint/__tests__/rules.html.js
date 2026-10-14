// regenerate after every snapshot change: bun run --filter '@jlg/oxlint' report
// ui.css vendored from jgeschwendt/ui @ 162e78b

const snapshot = await Bun.file(
  new URL('__snapshots__/rules.test.js.snap', import.meta.url),
).text();
const rows = [...snapshot.matchAll(/^ {2}"(?<line>.+)",$/gmu)].map(
  ({ groups: { line = '' } = {} }) => line.split(' | '),
);

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
      th {
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
        </div>
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
      let [sort, dir] = [0, 1];
      const selects = columns.slice(1).map((name, index) => {
        const label = Object.assign(document.createElement('label'), { className: 'field' });
        const select = Object.assign(document.createElement('select'), { className: 'select select-sm' });
        const values = [...new Set(rows.map((row) => row[index + 1]))].sort();
        select.append(...['any', ...values].map((value) => new Option(value)));
        select.addEventListener('input', render);
        label.append(Object.assign(document.createElement('span'), { className: 'label', textContent: name }), select);
        document.querySelector('#filters').append(label);
        return select;
      });
      head.append(
        ...columns.map((name, index) => {
          const th = document.createElement('th');
          th.textContent = name;
          th.addEventListener('click', () => {
            [sort, dir] = [index, sort === index ? -dir : 1];
            render();
          });
          return th;
        }),
      );
      /** a pill per value but the rule and \`-\` */
      const cell = (value, index) => {
        const td = document.createElement('td');
        td.append(
          index === 0 || value === '-'
            ? value
            : Object.assign(document.createElement('span'), {
                className: \`pill \${pills[value] ? \`pill-\${pills[value]}\` : ''}\`,
                textContent: value,
              }),
        );
        return td;
      };
      function render() {
        const query = filter.value.trim().toLowerCase();
        const shown = rows
          .filter(
            (row) =>
              row[0].includes(query) &&
              selects.every((select, index) => ['any', row[index + 1]].includes(select.value)),
          )
          .sort((a, b) => dir * a[sort].localeCompare(b[sort]) || a[0].localeCompare(b[0]));
        document.querySelector('#body').replaceChildren(
          ...shown.map((row) => {
            const tr = document.createElement('tr');
            tr.classList.toggle('is-muted', row[3] === 'none' || row[4] === 'off');
            tr.append(...row.map(cell));
            return tr;
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

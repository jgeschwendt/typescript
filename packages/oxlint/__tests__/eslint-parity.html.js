// regenerate after every snapshot change: bun run --filter '@jlg/oxlint' report

const snapshot = await Bun.file(
  new URL('__snapshots__/eslint-parity.test.js.snap', import.meta.url),
).text();
const rows = [...snapshot.matchAll(/^ {2}"(?<line>.+)",$/gmu)].map(
  ({ groups: { line = '' } = {} }) => line.split(' | '),
);

const html = new URL('eslint-parity.html', import.meta.url);
await Bun.write(
  html,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>@jlg/oxlint · ESLint parity</title>
    <style>
      :root {
        color-scheme: light dark;
        --differs: #fdf3c8;
        --line: #e2e2e2;
        --muted: #8a8a8a;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --differs: #3a3214;
          --line: #333;
          --muted: #777;
        }
      }
      body {
        font: 14px/1.45 system-ui, sans-serif;
        margin: 0 auto;
        max-width: 60rem;
        padding: 1.5rem;
      }
      header {
        align-items: center;
        background: Canvas;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 0.5rem 0;
        position: sticky;
        top: 0;
      }
      input {
        flex: 1;
        font: inherit;
        min-width: 12rem;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th,
      td {
        border-bottom: 1px solid var(--line);
        padding: 0.2rem 0.5rem;
        text-align: left;
      }
      th {
        cursor: pointer;
        user-select: none;
      }
      th[data-dir]::after {
        content: attr(data-dir);
        padding-left: 0.25rem;
      }
      td:first-child {
        font-family: ui-monospace, monospace;
      }
      .muted {
        color: var(--muted);
      }
      .differs {
        background: var(--differs);
      }
    </style>
  </head>
  <body>
    <h1>@jlg/eslint → @jlg/oxlint parity</h1>
    <header>
      <input id="filter" type="search" placeholder="filter rules" autofocus />
      <output id="count"></output>
    </header>
    <table>
      <thead>
        <tr id="head"></tr>
      </thead>
      <tbody id="body"></tbody>
    </table>
    <script id="rows" type="application/json">
      ${JSON.stringify(rows)}
    </script>
    <script>
      const rows = JSON.parse(document.querySelector('#rows').textContent);
      const columns = ['rule', 'old', 'oxlint', 'base', 'options'];
      const filter = document.querySelector('#filter');
      const head = document.querySelector('#head');
      let [sort, dir] = [0, 1];
      const selects = columns.slice(1).map((name, index) => {
        const label = document.createElement('label');
        const select = document.createElement('select');
        const values = [...new Set(rows.map((row) => row[index + 1]))].sort();
        select.append(...['any', ...values].map((value) => new Option(value)));
        select.addEventListener('input', render);
        label.append(\`\${name} \`, select);
        document.querySelector('#count').before(label);
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
            tr.classList.toggle('muted', row[2] === 'none' || row[3] === 'off');
            tr.classList.toggle('differs', row[4] === 'differs');
            tr.append(...row.map((cell) => Object.assign(document.createElement('td'), { textContent: cell })));
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

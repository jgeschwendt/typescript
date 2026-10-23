// one bitmap cell, in CSS pixels
const cell = 2;
const svg = 'http://www.w3.org/2000/svg';
// rows top to bottom, lit cells as 1: the classic 3×5 numerals and a 5×4 check
const bitmaps = new Map(
  Object.entries({
    '0': '111 101 101 101 111',
    '1': '010 110 010 010 111',
    '2': '111 001 111 100 111',
    '3': '111 001 111 001 111',
    '4': '101 101 111 001 001',
    '5': '111 100 111 001 111',
    '6': '111 100 111 101 111',
    '7': '111 001 001 001 001',
    '8': '111 101 111 101 111',
    '9': '111 101 111 001 111',
    '✓': '00001 00010 10100 01000',
  }).map(([char, rows]) => [char, rows.split(' ')]),
);

// the run's lit cells as unit squares, glyphs one cell apart, and its width in cells
const trace = (runs: string[][]): { squares: string; width: number } => {
  const squares: string[] = [];
  let left = 0;
  for (const rows of runs) {
    for (const [y, row] of rows.entries()) {
      for (const { index: x } of row.matchAll(/1/gu)) {
        squares.push(`M${left + x} ${y}h1v1h-1z`);
      }
    }
    const [first = ''] = rows;
    left += first.length + 1;
  }
  return { squares: squares.join(''), width: Math.max(left - 1, 0) };
};

const draw = <Tag extends keyof SVGElementTagNameMap>(
  tag: Tag,
  attributes: Record<string, number | string> = {},
): SVGElementTagNameMap[Tag] => {
  const element = document.createElementNS(svg, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
};

/**
`text` drawn as one path of unit squares at `cell` pixels each; characters without a bitmap are skipped.
*/
const glyph = (text: string): SVGSVGElement => {
  const runs = Array.from(text.matchAll(/./gu), ([char]) => bitmaps.get(char)).filter(
    (rows) => rows !== undefined,
  );
  const { squares, width } = trace(runs);
  const height = Math.max(0, ...runs.map((rows) => rows.length));
  const image = draw('svg', {
    'aria-hidden': 'true',
    height: height * cell,
    viewBox: `0 0 ${width} ${height}`,
    width: width * cell,
  });
  const path = draw('path');
  path.setAttribute('d', squares);
  image.append(path);
  return image;
};

export { glyph };

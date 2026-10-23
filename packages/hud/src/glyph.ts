import { outlines } from './outlines.js';

// every outline's box, in CSS pixels
const height = 10;
const svg = 'http://www.w3.org/2000/svg';

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
`text` as IBM Plex Mono outlines, one path per character on a 10px box, its ink centred in an even width so a centred pin keeps it on whole pixels; characters without an outline are skipped.
*/
const glyph = (text: string): SVGSVGElement => {
  let end = 0;
  const placed = Array.from(text, (char) => outlines.get(char))
    .filter((outline) => outline !== undefined)
    .map(({ advance, path, width }) => {
      end += advance;
      return { left: end - advance, path, right: end - advance + width };
    });
  const ink = placed.at(-1)?.right ?? 0;
  const width = 2 * Math.round(ink / 2);
  const image = draw('svg', {
    'aria-hidden': 'true',
    height,
    viewBox: `0 0 ${width} ${height}`,
    width,
  });
  image.append(
    ...placed.map(({ left, path }) => {
      const element = draw('path', {
        transform: `translate(${(left + (width - ink) / 2).toFixed(2)} 0)`,
      });
      element.setAttribute('d', path);
      return element;
    }),
  );
  return image;
};

export { glyph };

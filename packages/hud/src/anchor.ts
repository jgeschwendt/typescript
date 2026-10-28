type Pin = {
  x: number;
  y: number;
};

const percent = 100;
const hundredths = 100;

const share = (offset: number, size: number): number =>
  Math.round(Math.min(1, Math.max(0, offset / (size || 1))) * percent * hundredths) / hundredths;

/**
The `{x, y}` percentages (0–100) of a client point inside `element`'s box, clamped to it.
*/
const pinOf = (element: Element, clientX: number, clientY: number): Pin => {
  const { height, left, top, width } = element.getBoundingClientRect();
  return { x: share(clientX - left, width), y: share(clientY - top, height) };
};

/**
The document coordinates of a pin on `element`.
*/
const placeOf = (element: Element, { x, y }: Pin): { left: number; top: number } => {
  const { height, left, top, width } = element.getBoundingClientRect();
  return {
    left: left + scrollX + (width * x) / percent,
    top: top + scrollY + (height * y) / percent,
  };
};

/**
The element `selector` names under `root`, or undefined — for an invalid selector too.
*/
const resolve = (selector: string, root: ParentNode = document): Element | undefined => {
  const find = (): Element | undefined => root.querySelector(selector) ?? undefined;
  try {
    return find();
  } catch {
    return undefined;
  }
};

/**
Whether `selector` matches exactly one element under `root`.
*/
const unique = (selector: string, root: ParentNode = document): boolean =>
  root.querySelectorAll(selector).length === 1;

const nthOfType = (element: Element): string => {
  const siblings = [...(element.parentElement?.children ?? [element])].filter(
    (sibling) => sibling.localName === element.localName,
  );
  return `${element.localName}:nth-of-type(${siblings.indexOf(element) + 1})`;
};

const grow = (node: Element | null, path: string, scope: ParentNode): string => {
  if (!node) {
    return path;
  }
  const join = (part: string): string => (path ? `${part} > ${path}` : part);
  const strict = join(nthOfType(node));
  const parts = [...(node.id ? [`#${CSS.escape(node.id)}`] : []), node.localName].map((part) =>
    join(part),
  );
  return (
    [...parts, strict].find((selector) => unique(selector, scope)) ??
    grow(node.parentElement, strict, scope)
  );
};

/**
A short selector unique in `element`'s document: `#id`, else the tag, else tag:nth-of-type, grown up the tree.
*/
const selectorFor = (element: Element): string => grow(element, '', element.ownerDocument);

/**
Whether `element` renders: connected, displayed up the tree, not visibility-hidden.
*/
const visible = (element: Element): boolean =>
  element.checkVisibility({ visibilityProperty: true });

export { type Pin, pinOf, placeOf, resolve, selectorFor, unique, visible };

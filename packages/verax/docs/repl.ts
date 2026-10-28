/// <reference lib="dom" />
// The docs page's blocks run as one module; each block's console.log lands under it. The test
// suite runs the same program, so every output the page shows is one a run printed.

/**
A value as the page prints it: a string bare at the top level and single-quoted inside, objects on one line until 72 columns, then one entry per line.
*/
export const show = (value: unknown, indent = '', top = true): string => {
  if (typeof value === 'string') {
    if (top) {
      return value;
    }
    return value.includes("'") ? JSON.stringify(value) : `'${value}'`;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (typeof value !== 'object' || value === null) {
    return String(value);
  }
  const array = Array.isArray(value);
  const inner = `${indent}  `;
  const entries = Object.entries(value).map(([key, each]) => {
    const shown = show(each, inner, false);
    return array
      ? shown
      : `${/^[$A-Z_a-z][\w$]*$/u.test(key) ? key : JSON.stringify(key)}: ${shown}`;
  });
  const [open, close] = array ? ['[', ']'] : ['{ ', ' }'];
  const line =
    entries.length === 0 ? (array ? '[]' : '{}') : `${open}${entries.join(', ')}${close}`;
  return line.length + indent.length <= 72 && !line.includes('\n')
    ? line
    : `${open.trim()}\n${entries.map((entry) => `${inner}${entry},`).join('\n')}\n${indent}${close.trim()}`;
};

/**
Runs the blocks as one module, `verax` imports resolved through `specifiers`, and returns what each block printed. `load` imports a module's source: from a file in the test, a Blob on the page.
*/
export const execute = async (
  blocks: readonly string[],
  specifiers: Readonly<Record<string, string>>,
  load: (source: string) => Promise<unknown>,
): Promise<string[]> => {
  const printed = blocks.map((): string[] => []);
  let at = 0;
  Reflect.set(globalThis, 'repl', {
    at: (block: number) => {
      at = block;
    },
    log: (...values: unknown[]) => {
      printed[at]?.push(values.map((value) => show(value)).join(' '));
    },
  });
  const source = [
    'const console = globalThis.repl;',
    ...blocks.flatMap((code, block) => [`globalThis.repl.at(${block});`, code]),
  ]
    .join('\n')
    .replaceAll(
      /from '(?<name>verax(?:\/sdl)?)'/gu,
      (_, name: string) => `from '${specifiers[name] ?? name}'`,
    );
  try {
    await load(source);
  } catch (error) {
    printed[at]?.push(show(error));
  }
  return printed.map((lines) => lines.join('\n'));
};

const here = new URL('./', import.meta.url);
const specifiers = {
  verax: `${here}index.js`,
  'verax/sdl': `${here}sdl.js`,
};
const sucrase = 'https://esm.sh/sucrase@3.35.1';
const load = async (source: string): Promise<unknown> => {
  const { transform } = (await import(sucrase)) as {
    transform: (code: string, options: object) => { code: string };
  };
  const { code } = transform(source, { disableESTransforms: true, transforms: ['typescript'] });
  return import(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
};

/**
Makes the page's blocks editable and runnable: ▶ or ⌘↵ reruns every block and marks each output the same as the page's or changed.
*/
export const start = (): void => {
  const codes = [...document.querySelectorAll<HTMLElement>('pre[data-ts] > code')];
  const outputs = codes.map((code) => {
    const pre = code.parentElement;
    const next = pre?.nextElementSibling;
    if (next instanceof HTMLPreElement && next.dataset['out'] !== undefined) {
      return next;
    }
    const output = document.createElement('pre');
    output.classList.add('snippet');
    output.dataset['out'] = '';
    pre?.after(output);
    return output;
  });
  const shown = outputs.map((output) => output.textContent);
  const render = (printed: readonly string[]): void => {
    for (const [block, output] of outputs.entries()) {
      output.textContent = printed[block] ?? '';
      output.dataset['state'] = output.textContent === shown[block] ? 'same' : 'changed';
    }
  };
  const rerun = async (): Promise<void> => {
    try {
      render(
        await execute(
          codes.map((code) => code.textContent),
          specifiers,
          load,
        ),
      );
    } catch (error) {
      render(outputs.map(() => show(error)));
    }
  };
  for (const code of codes) {
    const run = document.createElement('button');
    run.classList.add('btn', 'btn-sm', 'btn-ghost');
    run.textContent = '▶ run';
    run.type = 'button';
    run.addEventListener('click', () => {
      void rerun();
    });
    code.before(run);
    code.contentEditable = 'plaintext-only';
    code.spellcheck = false;
    code.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      void rerun();
    });
  }
};

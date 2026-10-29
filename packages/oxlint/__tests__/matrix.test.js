import { afterAll, expect, test } from 'bun:test';
import { loadRules, within } from './_helpers.js';

// what each file resolves to per detected environment: oxlint prints no per-file config, so this resolves as oxlint does (verified 2026-10-28 · lint probe)

/** each environment as a consumer's devDependencies declare it */
const combos = {
  bun: { '@types/bun': '*' },
  js: {},
  typescript: { typescript: '*' },
  'typescript+react': { react: '*', typescript: '*' },
  'typescript+react+next': { next: '*', react: '*', typescript: '*' },
};
/** one file per distinct resolution: a.cjs, a.mjs resolve as a.js; a.cts, a.mts, sub/next.config.ts as a.ts; __tests__/a.ts as a.test.ts; the other segments as app/error.tsx; app/layout.tsx as app/page.tsx; app/manifest.ts, app/sitemap.ts as app/robots.ts; the other images as app/icon.tsx; middleware.ts as proxy.ts; oxlint.config.ts as next.config.ts */
const paths = [
  'a.js',
  'a.jsx',
  'a.test.ts',
  'a.ts',
  'a.tsx',
  'app/api/route.ts',
  'app/error.tsx',
  'app/icon.tsx',
  'app/layout.jsx',
  'app/page.js',
  'app/page.tsx',
  'app/robots.ts',
  'app/route.js',
  'eslint.config.js',
  'instrumentation.js',
  'instrumentation.ts',
  'mdx-components.tsx',
  'next.config.ts',
  'proxy.ts',
];

const catalog = loadRules().values().toArray();
/**
the rules `plugins`' enabled categories turn on, by config key: eslint's bare, a scope's underscores as hyphens
@param {import('oxlint').OxlintConfig} built
@param {string[]} plugins
*/
const enable = ({ categories = {} }, plugins) => {
  const levels = new Map(Object.entries(categories));
  return Object.fromEntries(
    catalog.flatMap(({ category, scope, value }) => {
      const plugin = scope.replaceAll('_', '-');
      const severity = levels.get(category) ?? 'off';
      return severity !== 'off' && plugins.includes(plugin)
        ? [[plugin === 'eslint' ? value : `${plugin}/${value}`, severity]]
        : [];
    }),
  );
};

/**
an override's globs: oxlint anchors `./` at the config's directory
@param {string[]} files
*/
const globs = (files) => files.map((glob) => new Bun.Glob(glob.replace(/^\.\//u, '')));

/**
the root, then each override whose globs match in order: a rule entry replaces, env, globals and plugins extend, a new plugin's categories turn on
@param {import('oxlint').OxlintConfig} built
@param {string} path
*/
const resolve = (built, path) => {
  const { overrides = [], plugins = [] } = built;
  const matching = overrides.filter(({ files }) => globs(files).some((glob) => glob.match(path)));
  const found = {
    env: { ...built.env },
    globals: { ...built.globals },
    plugins: [...plugins],
    rules: { ...enable(built, plugins), ...built.rules },
  };
  for (const { env, globals, plugins: more = [], rules } of matching) {
    const added = more.filter((plugin) => !found.plugins.includes(plugin));
    Object.assign(found.env, env);
    Object.assign(found.globals, globals);
    found.plugins.push(...added);
    Object.assign(found.rules, enable(built, added), rules);
  }
  return found;
};

/**
one value per line key: `(env)`, `(globals)`, `(plugins)`, then each rule as `severity [options]`
@param {ReturnType<typeof resolve>} found
@returns {Record<string, string>}
*/
const render = ({ rules, ...rest }) =>
  Object.fromEntries([
    ...Object.entries(rest).map(([name, value]) => [`(${name})`, JSON.stringify(value)]),
    ...Object.entries(rules).map(([name, value]) => {
      const [severity, ...options] = [value].flat();
      return [name, options.length > 0 ? `${severity} ${JSON.stringify(options)}` : severity];
    }),
  ]);

/** in order, as within changes cwd: combo → path → resolution */
const resolved = Object.fromEntries(
  await Array.fromAsync(Object.entries(combos), async ([combo, devDependencies]) => {
    const built = await within({ 'package.json': { devDependencies } });
    return [combo, Object.fromEntries(paths.map((path) => [path, render(resolve(built, path))]))];
  }),
);
// the TypeScript combos set it, and spawned oxlint runs inherit it
afterAll(() => Reflect.deleteProperty(process.env, 'OXLINT_TSGOLINT_PATH'));

/**
the lines where `found` differs from `base`, an absent rule `unset`
@param {Record<string, string>} found
@param {Record<string, string>} [base]
*/
const delta = (found, base = {}) =>
  [...new Set([...Object.keys(found), ...Object.keys(base)])]
    .filter((key) => found[key] !== base[key])
    .toSorted()
    .map((key) => `${key}: ${found[key] ?? 'unset'}`)
    .join('\n');

/** the TypeScript combo's a.ts in full; every other file its delta from that, a script's from its a.js */
const { typescript: anchor = {} } = resolved;
/** [files, base, delta] as JSON → the combos that share it */
const groups = new Map();
for (const [combo, files] of Object.entries(resolved)) {
  const byDelta = Map.groupBy(paths, (path) => {
    const base =
      /\.[cm]?jsx?$/u.test(path) && `${combo}/${path}` !== 'typescript/a.js' ? 'a.js' : 'a.ts';
    return JSON.stringify([base, delta(files[path] ?? {}, anchor[base])]);
  });
  for (const [key, list] of byDelta) {
    const group = JSON.stringify([list.join(', '), ...JSON.parse(key)]);
    groups.set(group, [...(groups.get(group) ?? []), combo]);
  }
}

test('typescript / a.ts in full', () => {
  expect(delta(anchor['a.ts'] ?? {})).toMatchSnapshot();
});

test.each(
  [...groups].map(([group, environments]) => {
    const [files, base, lines] = JSON.parse(group);
    return [`${environments.join(', ')} / ${files} from typescript / ${base}`, lines];
  }),
)('%s', (_title, lines) => {
  expect(lines).toMatchSnapshot();
});

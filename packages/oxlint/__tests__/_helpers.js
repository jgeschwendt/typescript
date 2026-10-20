import { defineConfig } from '../index.js';

const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } =
  process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');
const { basename, dirname, join } = process.getBuiltinModule('node:path');

const oxlintDirectory = dirname(Bun.fileURLToPath(import.meta.resolve('oxlint/package.json')));
const oxlintBin = join(oxlintDirectory, 'bin', 'oxlint');

/** every environment on: the most any consumer gets */
const everything = { next: true, react: true, typescript: true };
const config = defineConfig({ env: everything });
const overrides = config.overrides ?? [];

/**
@param {string} root
@param {Record<string, unknown>} files a string is written as is, anything else as JSON
*/
const write = (root, files) => {
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), typeof source === 'string' ? source : JSON.stringify(source));
  }
};

/**
runs oxlint in `cwd` and parses its JSON report, throwing with oxlint's own output when it is not JSON
@param {string} cwd
@param {string[]} flags
@param {string[]} [command] a runtime and oxlint's bin, so neither the exec bit nor PATH matters
*/
const spawnOxlint = (cwd, flags, command = [process.execPath, oxlintBin]) => {
  const out = join(cwd, 'oxlint.out');
  // stdout to a file: a piped read came back truncated on linux CI (observed 2026-09-09);
  // a Bun.file stdout overwrites without truncating, so empty it for a reused cwd (verified 2026-10-14 · probe)
  writeFileSync(out, '');
  const { exitCode, stderr } = Bun.spawnSync([...command, ...flags], {
    cwd,
    stdout: Bun.file(out),
  });
  const text = String(readFileSync(out));
  const output = `${text}${stderr.toString()}`;
  try {
    return { exitCode, output, report: JSON.parse(text) };
  } catch {
    throw new Error(`oxlint exited ${exitCode}: ${output}`);
  }
};

/** @returns {{ category: string; scope: string; type_aware: boolean; value: string }[]} */
const loadRules = () => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-rules-'));
  // --rules still loads config, so hand it an empty one
  write(directory, { 'empty.json': '{}' });
  const { report } = spawnOxlint(directory, [
    '-c',
    'empty.json',
    '--rules',
    '--format',
    'json',
    '--disable-nested-config',
  ]);
  rmSync(directory, { force: true, recursive: true });
  return report;
};

const ruleNames = [
  ...new Set(
    [config.rules, ...overrides.map((override) => override.rules)].flatMap((rules) =>
      Object.keys(rules ?? {}),
    ),
  ),
];

/** @type {{ name?: string; specifier: string }[]} jsPlugins entries, a bare path as an unnamed one */
const jsEntries = (config.jsPlugins ?? []).map((entry) =>
  typeof entry === 'string' ? { specifier: entry } : entry,
);
const jsScopes = new Set(
  jsEntries.map(({ name, specifier }) => name ?? basename(specifier, '.mjs')),
);

/** @param {string} name */
const isJsRule = (name) => jsScopes.has(name.replace(/\/.*/u, ''));

/**
catalog scopes spell hyphens as underscores (`jsx-a11y` → `jsx_a11y`)
@param {string} name
*/
const ruleScope = (name) =>
  name.includes('/') ? name.replace(/\/.*/u, '').replaceAll('-', '_') : 'eslint';

/** @param {string} name */
const ruleKey = (name) => `${ruleScope(name)}/${name.replace(/^[^/]*\//u, '')}`;

const enabledScopes = new Set((config.plugins ?? []).map((plugin) => plugin.replaceAll('-', '_')));

export {
  config,
  enabledScopes,
  everything,
  isJsRule,
  jsEntries,
  jsScopes,
  loadRules,
  overrides,
  ruleKey,
  ruleNames,
  spawnOxlint,
  write,
};

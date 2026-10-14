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
 * @param {string} root
 * @param {Record<string, string>} files
 */
const write = (root, files) => {
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), source);
  }
};

/**
 * runs oxlint in `cwd` and parses its JSON report, throwing with oxlint's own output when it is not JSON
 * @param {string} cwd
 * @param {string[]} flags
 * @param {string[]} [command] a runtime and oxlint's bin, so neither the exec bit nor PATH matters
 */
const spawnOxlint = (cwd, flags, command = [process.execPath, oxlintBin]) => {
  const out = join(cwd, 'oxlint.out');
  // stdout to a file: a piped read came back truncated on linux CI (observed 2026-09-09);
  // a Bun.file stdout overwrites without truncating, so empty it for a reused cwd (verified 2026-10-14 · probe)
  writeFileSync(out, '');
  const { exitCode, stderr } = Bun.spawnSync([...command, ...flags], {
    cwd,
    stderr: 'pipe',
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
  try {
    // --rules still loads config, so hand it an empty one
    write(directory, { 'empty.json': '{}' });
    const { exitCode, output, report } = spawnOxlint(directory, [
      '-c',
      'empty.json',
      '--rules',
      '--format',
      'json',
      '--disable-nested-config',
    ]);
    if (exitCode !== 0) {
      throw new Error(`oxlint --rules exited ${exitCode}: ${output}`);
    }
    return report;
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

const schema = String(readFileSync(join(oxlintDirectory, 'configuration_schema.json')));
/** @type {string[]} */
const pluginNames = JSON.parse(schema).definitions.LintPluginOptionsSchema.enum;

const ruleNames = [
  ...new Set(
    [config.rules, ...overrides.map((override) => override.rules)].flatMap((rules) =>
      Object.keys(rules ?? {}),
    ),
  ),
];

const jsScopes = new Set(
  (config.jsPlugins ?? []).map((entry) =>
    typeof entry === 'string' ? basename(entry, '.mjs') : entry.name,
  ),
);

/** @param {string} name */
const isJsRule = (name) => jsScopes.has(name.replace(/\/.*/u, ''));

/**
 * catalog scopes spell hyphens as underscores (`jsx-a11y` → `jsx_a11y`)
 * @param {string} name
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
  jsScopes,
  loadRules,
  overrides,
  pluginNames,
  ruleKey,
  ruleNames,
  ruleScope,
  spawnOxlint,
  write,
};

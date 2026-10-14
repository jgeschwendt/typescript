import { defineConfig } from '../index.js';

const { mkdtempSync, readFileSync, rmSync, writeFileSync } = process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');
const { basename, dirname, join } = process.getBuiltinModule('node:path');

const oxlintDirectory = dirname(Bun.fileURLToPath(import.meta.resolve('oxlint/package.json')));
const oxlintBin = join(oxlintDirectory, 'bin', 'oxlint');

/** every environment on: the most any consumer gets */
const everything = { next: true, react: true, typescript: true };
const config = defineConfig({ env: everything });
const overrides = config.overrides ?? [];

/** @returns {{ category: string; scope: string; type_aware: boolean; value: string }[]} */
const loadRules = () => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-rules-'));
  try {
    // --rules still discovers config, so run from a temp dir with an empty one
    writeFileSync(join(directory, '.oxlintrc.json'), '{}');
    const out = join(directory, 'rules.json');
    // stdout to a file: a piped read came back truncated on linux CI (observed 2026-09-09)
    const result = Bun.spawnSync(
      [process.execPath, oxlintBin, '--rules', '--format', 'json', '--disable-nested-config'],
      { cwd: directory, stderr: 'pipe', stdout: Bun.file(out) },
    );
    if (result.exitCode !== 0) {
      throw new Error(`oxlint --rules exited ${result.exitCode}: ${result.stderr.toString()}`);
    }
    return JSON.parse(String(readFileSync(out)));
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
  oxlintBin,
  overrides,
  pluginNames,
  ruleKey,
  ruleNames,
  ruleScope,
};

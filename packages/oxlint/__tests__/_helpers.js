import { parse } from 'jsonc-parser';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = import.meta.dirname;

const oxlintDirectory = dirname(require.resolve('oxlint/package.json'));

const oxlintBin = join(oxlintDirectory, 'bin', 'oxlint');
const schemaPath = join(oxlintDirectory, 'configuration_schema.json');
const configPath = join(here, '..', 'oxlintrc.jsonc');

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
    return JSON.parse(readFileSync(out));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

/** jsonc-parser is fault-tolerant: surface its errors, or a broken config yields undefined */
const loadConfig = () => {
  const errors = [];
  const config = parse(readFileSync(configPath, 'utf8'), errors, {
    allowTrailingComma: true,
  });
  if (errors.length > 0) {
    throw new Error(`oxlintrc.jsonc failed to parse: ${JSON.stringify(errors)}`);
  }
  return config;
};

const loadPluginNames = () => {
  const schema = JSON.parse(readFileSync(schemaPath));
  return schema.definitions.LintPluginOptionsSchema.enum;
};

const configRuleNames = (config) => {
  const names = new Set(Object.keys(config.rules ?? {}));
  for (const override of config.overrides ?? []) {
    for (const name of Object.keys(override.rules ?? {})) {
      names.add(name);
    }
  }
  return [...names];
};

/** catalog scopes spell hyphens as underscores (`jsx-a11y` → `jsx_a11y`) */
const ruleScope = (name) => {
  const slash = name.indexOf('/');
  return slash === -1 ? 'eslint' : name.slice(0, slash).replaceAll('-', '_');
};

const ruleKey = (name) => {
  const slash = name.indexOf('/');
  return slash === -1 ? `eslint/${name}` : `${ruleScope(name)}/${name.slice(slash + 1)}`;
};

const jsPluginScopes = (config) =>
  new Set(
    (config.jsPlugins ?? []).map((entry) =>
      typeof entry === 'string'
        ? entry
            .split('/')
            .pop()
            .replace(/\.m?js$/u, '')
        : entry.name,
    ),
  );

const enabledScopes = (config) =>
  new Set((config.plugins ?? []).map((plugin) => plugin.replaceAll('-', '_')));

export {
  configRuleNames,
  enabledScopes,
  jsPluginScopes,
  loadConfig,
  loadPluginNames,
  loadRules,
  oxlintBin,
  ruleKey,
  ruleScope,
};

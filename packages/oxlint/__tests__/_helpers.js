// Shared helpers for the oxlint config tests. Not a test file (bun test only
// discovers `*.test.*` / `*.spec.*`), so it is never run on its own.

import { parse } from 'jsonc-parser';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = import.meta.dirname;

// Resolve oxlint from wherever the workspace installed it (root-hoisted or the
// package's own node_modules) via Node's module resolution, then locate its
// bundled binary and JSON schema relative to the package root.
const oxlintDirectory = dirname(require.resolve('oxlint/package.json'));

const oxlintBin = join(oxlintDirectory, 'bin', 'oxlint');
const schemaPath = join(oxlintDirectory, 'configuration_schema.json');
const configPath = join(here, '..', 'oxlintrc.jsonc');

// The full rule catalog: `[{ scope, value, category, type_aware, ... }, …]`.
// 870 rules as of oxlint 1.82 (measured 2026-09-08 · `oxlint --rules --format json`). Spawned through `process.execPath` so it works
// regardless of the bin's exec bit or PATH.
//
// `--rules` still performs oxlint's config discovery and exits non-zero if the
// nearest `.oxlintrc.json` (walking up to the repo root, which extends THIS
// package) is broken — including while test 1's own fixture deliberately breaks
// it. Run from an isolated temp dir holding an empty `{}` config so the catalog
// is always readable and this helper never masks the assertion that should fire.
//
// stdout goes to a FILE in that temp dir, not a pipe: the catalog is ~230 kB,
// and on the Linux runner a piped read came back truncated mid-string
// ("JSON Parse error: Unterminated string") in one of the two callers while
// the other, identical spawn succeeded — a pipe race, not a size cap.
// (observed 2026-09-09 · ci run 34302573741, bun 1.3.14 on ubuntu-latest)
const loadRules = () => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-rules-'));
  try {
    writeFileSync(join(directory, '.oxlintrc.json'), '{}');
    const out = join(directory, 'rules.json');
    const result = Bun.spawnSync(
      [
        process.execPath,
        oxlintBin,
        '--rules',
        '--format',
        'json',
        '--disable-nested-config',
      ],
      { cwd: directory, stderr: 'pipe', stdout: Bun.file(out) },
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `oxlint --rules exited ${result.exitCode}: ${result.stderr.toString()}`,
      );
    }
    return JSON.parse(readFileSync(out, 'utf8'));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

// The oxlintrc.jsonc config, parsed with jsonc-parser (comments + trailing
// commas). jsonc-parser is fault-tolerant; surface parse errors ourselves so a
// malformed config fails loudly instead of silently yielding `undefined`.
const loadConfig = () => {
  const errors = [];
  const config = parse(readFileSync(configPath, 'utf8'), errors, {
    allowTrailingComma: true,
  });
  if (errors.length > 0) {
    throw new Error(
      `oxlintrc.jsonc failed to parse: ${JSON.stringify(errors)}`,
    );
  }
  return config;
};

// The set of valid plugin names, straight from oxlint's own JSON schema.
const loadPluginNames = () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  return schema.definitions.LintPluginOptionsSchema.enum;
};

// Every rule name referenced by the config: top-level `rules` plus every
// `overrides[].rules`.
const configRuleNames = (config) => {
  const names = new Set(Object.keys(config.rules ?? {}));
  for (const override of config.overrides ?? []) {
    for (const name of Object.keys(override.rules ?? {})) {
      names.add(name);
    }
  }
  return [...names];
};

// The catalog scope a config rule name resolves to. Bare names (`no-void`) belong
// to the `eslint` scope; namespaced names (`import/no-default-export`) take their
// namespace. Rule namespaces are hyphenated (`jsx-a11y/…`) but catalog scopes use
// underscores (`jsx_a11y`); normalize so the two sides compare.
const ruleScope = (name) => {
  const slash = name.indexOf('/');
  return slash === -1 ? 'eslint' : name.slice(0, slash).replaceAll('-', '_');
};

// Map a config rule name to its `scope/value` catalog key.
const ruleKey = (name) => {
  const slash = name.indexOf('/');
  return slash === -1
    ? `eslint/${name}`
    : `${ruleScope(name)}/${name.slice(slash + 1)}`;
};

// The rule namespaces `jsPlugins` adds: an aliased entry's `name`, or a local
// plugin file's basename (`./plugins/eslint-js.mjs` → `eslint-js`, which the
// js-plugins test holds equal to the file's `meta.name`). Their rules are ESLint
// rule code, absent from oxlint's catalog by design, so the native-rule guards
// skip them and js-plugins.test.js checks them against the plugins instead.
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

// The catalog scopes the config's `plugins` array turns on, normalized to match
// catalog scope spelling (`react-perf` → `react_perf`).
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

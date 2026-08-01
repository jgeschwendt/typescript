// Shared helpers for the oxlint config tests. Not a test file (bun test only
// discovers `*.test.*` / `*.spec.*`), so it is never run on its own.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse } from 'jsonc-parser';

const require = createRequire(import.meta.url);
const here = import.meta.dirname;

// Resolve oxlint from wherever the workspace installed it (root-hoisted or the
// package's own node_modules) via Node's module resolution, then locate its
// bundled binary and JSON schema relative to the package root.
const oxlintDir = dirname(require.resolve('oxlint/package.json'));

const oxlintBin = join(oxlintDir, 'bin', 'oxlint');
const schemaPath = join(oxlintDir, 'configuration_schema.json');
const configPath = join(here, '..', 'oxlintrc.jsonc');

// The full rule catalog: `[{ scope, value, category, type_aware, ... }, …]`.
// 841 rules as of oxlint 1.74. Spawned through `process.execPath` so it works
// regardless of the bin's exec bit or PATH.
//
// `--rules` still performs oxlint's config discovery and exits non-zero if the
// nearest `.oxlintrc.json` (walking up to the repo root, which extends THIS
// package) is broken — including while test 1's own fixture deliberately breaks
// it. Run from an isolated temp dir holding an empty `{}` config so the catalog
// is always readable and this helper never masks the assertion that should fire.
export function loadRules() {
  const dir = mkdtempSync(join(tmpdir(), 'oxlint-rules-'));
  try {
    writeFileSync(join(dir, '.oxlintrc.json'), '{}');
    return JSON.parse(
      execFileSync(
        process.execPath,
        [oxlintBin, '--rules', '--format', 'json', '--disable-nested-config'],
        { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
      ),
    );
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

// The oxlintrc.jsonc config, parsed with jsonc-parser (comments + trailing
// commas). jsonc-parser is fault-tolerant; surface parse errors ourselves so a
// malformed config fails loudly instead of silently yielding `undefined`.
export function loadConfig() {
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
}

// The set of valid plugin names, straight from oxlint's own JSON schema.
export function loadPluginNames() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  return schema.definitions.LintPluginOptionsSchema.enum;
}

// Every rule name referenced by the config: top-level `rules` plus every
// `overrides[].rules`.
export function configRuleNames(config) {
  const names = new Set(Object.keys(config.rules ?? {}));
  for (const override of config.overrides ?? []) {
    for (const name of Object.keys(override.rules ?? {})) {
      names.add(name);
    }
  }
  return [...names];
}

// The catalog scope a config rule name resolves to. Bare names (`no-void`) belong
// to the `eslint` scope; namespaced names (`import/no-default-export`) take their
// namespace. Rule namespaces are hyphenated (`jsx-a11y/…`) but catalog scopes use
// underscores (`jsx_a11y`); normalize so the two sides compare.
export function ruleScope(name) {
  const slash = name.indexOf('/');
  return slash === -1 ? 'eslint' : name.slice(0, slash).replaceAll('-', '_');
}

// Map a config rule name to its `scope/value` catalog key.
export function ruleKey(name) {
  const slash = name.indexOf('/');
  return slash === -1
    ? `eslint/${name}`
    : `${ruleScope(name)}/${name.slice(slash + 1)}`;
}

// The catalog scopes the config's `plugins` array turns on, normalized to match
// catalog scope spelling (`react-perf` → `react_perf`).
export function enabledScopes(config) {
  return new Set(
    (config.plugins ?? []).map((plugin) => plugin.replaceAll('-', '_')),
  );
}

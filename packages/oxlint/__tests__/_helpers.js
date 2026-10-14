// Shared helpers for the oxlint config tests. Not a test file (bun test only
// discovers `*.test.*` / `*.spec.*`), so it is never run on its own.

import { parse } from 'jsonc-parser';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, parse as parsePath } from 'node:path';

const require = createRequire(import.meta.url);
const here = import.meta.dirname;

// Resolve oxlint from wherever the workspace installed it (root-hoisted or the
// package's own node_modules) via Node's module resolution, then locate its
// bundled binary and JSON schema relative to the package root.
const oxlintDirectory = dirname(require.resolve('oxlint/package.json'));

const oxlintBin = join(oxlintDirectory, 'bin', 'oxlint');
const schemaPath = join(oxlintDirectory, 'configuration_schema.json');

// Writes `{ relativePath: source }` under `root`, creating directories.
const write = (root, files) => {
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), source);
  }
};

// Runs `command` (a runtime and oxlint's bin, so the bin's exec bit and PATH
// never matter) with `flags` in `cwd` and parses its JSON report; a non-JSON
// stdout throws with oxlint's own output. stdout goes to a FILE, not a pipe: on
// the Linux runner a piped ~230 kB report came back truncated mid-string
// ("JSON Parse error: Unterminated string") in one of two identical spawns — a
// pipe race, not a size cap. (observed 2026-09-09 · ci run 34302573741, bun
// 1.3.14 on ubuntu-latest)
const spawnOxlint = (cwd, flags, command = [process.execPath, oxlintBin]) => {
  const out = join(cwd, 'oxlint.out');
  // a Bun.file stdout overwrites without truncating: empty it for a reused cwd
  // (verified 2026-10-14 · probe, bun 1.3.14)
  writeFileSync(out, '');
  const { exitCode, stderr } = Bun.spawnSync([...command, ...flags], {
    cwd,
    stderr: 'pipe',
    stdout: Bun.file(out),
  });
  const text = readFileSync(out, 'utf8');
  const output = `${text}${stderr.toString()}`;
  try {
    return { exitCode, output, report: JSON.parse(text) };
  } catch {
    throw new Error(`oxlint exited ${exitCode}: ${output}`);
  }
};

// The full rule catalog: `[{ scope, value, category, type_aware, ... }, …]`.
// `--rules` still runs config discovery and exits non-zero if the nearest
// `.oxlintrc.json` (the repo root's, which extends THIS package) is broken; an
// isolated temp dir holding `{}` keeps the catalog readable so a broken config
// fails its own assertion, not this helper.
const loadRules = () => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-rules-'));
  try {
    write(directory, { '.oxlintrc.json': '{}' });
    const { exitCode, output, report } = spawnOxlint(directory, [
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

// The oxlintrc.jsonc config, parsed with jsonc-parser (comments + trailing
// commas). jsonc-parser is fault-tolerant; surface parse errors ourselves so a
// malformed config fails loudly instead of silently yielding `undefined`.
const errors = [];
const config = parse(
  readFileSync(join(here, '..', 'oxlintrc.jsonc'), 'utf8'),
  errors,
  { allowTrailingComma: true },
);
if (errors.length > 0) {
  throw new Error(`oxlintrc.jsonc failed to parse: ${JSON.stringify(errors)}`);
}

// The set of valid plugin names, straight from oxlint's own JSON schema.
const loadPluginNames = () =>
  JSON.parse(readFileSync(schemaPath, 'utf8')).definitions
    .LintPluginOptionsSchema.enum;

// The catalog scope a config rule name resolves to. Bare names (`no-void`) belong
// to the `eslint` scope; namespaced names (`import/no-default-export`) take their
// namespace. Rule namespaces are hyphenated (`jsx-a11y/…`) but catalog scopes use
// underscores (`jsx_a11y`); normalize so the two sides compare.
const ruleScope = (name) => {
  const slash = name.indexOf('/');
  return slash === -1 ? 'eslint' : name.slice(0, slash).replaceAll('-', '_');
};

// Map a config rule name to its `scope/value` catalog key.
const ruleKey = (name) =>
  `${ruleScope(name)}/${name.slice(name.indexOf('/') + 1)}`;

// The rule namespaces `jsPlugins` adds: an aliased entry's `name`, or a local
// plugin file's basename (`./plugins/eslint-js.mjs` → `eslint-js`, which the
// js-plugins test holds equal to the file's `meta.name`).
const jsPluginScopes = new Set(
  config.jsPlugins.map((entry) => entry.name ?? parsePath(entry).name),
);

// Every rule name the config references (top-level `rules` plus every
// `overrides[].rules`), split by whether a jsPlugins scope owns it. jsPlugins
// rules are ESLint rule code, absent from oxlint's catalog by design, so the
// native-rule guards skip them and js-plugins.test.js checks them against the
// plugins instead.
const { js: jsRuleNames, native: nativeRuleNames } = Object.groupBy(
  new Set(
    [config, ...config.overrides].flatMap(({ rules }) =>
      Object.keys(rules ?? {}),
    ),
  ),
  (name) => (jsPluginScopes.has(name.split('/')[0]) ? 'js' : 'native'),
);

// The catalog scopes the config's `plugins` array turns on, normalized to match
// catalog scope spelling (`react-perf` → `react_perf`).
const enabledScopes = new Set(
  config.plugins.map((plugin) => plugin.replaceAll('-', '_')),
);

export {
  config,
  enabledScopes,
  jsPluginScopes,
  jsRuleNames,
  loadPluginNames,
  loadRules,
  nativeRuleNames,
  ruleKey,
  ruleScope,
  spawnOxlint,
  write,
};

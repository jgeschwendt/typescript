import { parse } from 'jsonc-parser';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = readFileSync(new URL('oxlintrc.jsonc', import.meta.url), 'utf8');
const errors = [];
const parsed = parse(source, errors, { allowTrailingComma: true });
// jsonc-parser returns partial data on malformed input instead of throwing
if (errors.length > 0) {
  throw new Error(`@jlg/oxlint: oxlintrc.jsonc failed to parse: ${JSON.stringify(errors)}`);
}

/** jsPlugins resolve against their config file, and a JS-config base has none */
const absolute = (specifier) => fileURLToPath(new URL(specifier, import.meta.url));

// ※ oxlint-base
const base = {
  ...parsed,
  jsPlugins: (parsed.jsPlugins ?? []).map((entry) =>
    typeof entry === 'string'
      ? absolute(entry)
      : Object.assign(entry, { specifier: absolute(entry.specifier) }),
  ),
};

const byExtension = /^\*\*\/\*\.[^/]+$/u;
/** file-named base overrides (Next, tooling) must outrank the consumer's own */
const trailing = (base.overrides ?? []).filter(
  (override) => !override.files.every((glob) => byExtension.test(glob)),
);

/** oxlint rejects version "detect"; without a semver eslint-plugin-react assumes latest */
const detectReact = () => {
  try {
    const require = createRequire(join(process.cwd(), 'package.json'));
    const { version } = require('react/package.json');
    const semver = /^\d+\.\d+\.\d+/u.exec(version);
    return semver === null ? {} : { version: semver[0] };
  } catch {
    return {};
  }
};

/** settings and file-named overrides cannot ride `extends`, so they go in the returned root */
// ※ oxlint-extends-objects
const defineConfig = (config = {}) => {
  const react = {
    ...detectReact(),
    ...base.settings?.react,
    ...config.settings?.react,
  };
  return {
    ...config,
    extends: [base, ...(config.extends ?? [])],
    overrides: [...(config.overrides ?? []), ...trailing],
    settings: {
      ...base.settings,
      ...config.settings,
      ...(Object.keys(react).length === 0 ? {} : { react }),
    },
  };
};

export { base, defineConfig };

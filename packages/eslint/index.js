// @ts-check
import fs from "node:fs";
import path from "node:path";
import javascript from "@eslint/js";
import prettier from "eslint-config-prettier";
import imports from "eslint-plugin-import";
// import react from "eslint-plugin-react";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import typescript from "typescript-eslint";

// https://eslint.org/docs/latest/rules/no-magic-numbers#options
const magicNumbers = {
  detectObjects: true,
  enforceConst: true,
  ignore: [-1, 0, 1, 2],
  ignoreArrayIndexes: false,
  ignoreClassFieldInitialValues: false,
  ignoreDefaultValues: false,
};

const constants = {
  MagicNumbers: magicNumbers,
  MagicNumbersTypescript:
    // https://typescript-eslint.io/rules/no-magic-numbers/#options
    {
      ignoreEnums: false,
      ignoreNumericLiteralTypes: false,
      ignoreReadonlyClassProperties: false,
      ignoreTypeIndexes: false,
      ...magicNumbers,
    },
  MaxStatementsJavaScript: 20,
};

const [preferNamedExports, preferDefaultExports] = [
  {
    "import/no-default-export": "error",
    "import/no-named-export": "off",
    "import/prefer-default-export": "off",
  },
  {
    "import/no-default-export": "off",
    "import/no-named-export": "error",
  },
];

const lookupPackageJson = () => {
  let cwd = process.cwd();

  while (cwd !== path.dirname("/")) {
    const packageJson = path.join(cwd, "package.json");

    if (fs.existsSync(packageJson)) {
      return JSON.parse(fs.readFileSync(packageJson).toString());
    }

    cwd = path.dirname(cwd);
  }

  // AIDEV-NOTE: this should probably switch to a warning instead of an error in the rc releases
  throw new Error(
    "package.json not found in current directory or any parent directory"
  );
};

const matchExtensions = (matches) => {
  const extensions = Object.entries(matches)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);

  if (extensions.length === 0)
    throw new Error(
      "`config()#matchExtensions` failed to match, please report this"
    );

  return extensions.length === 1 ? extensions : `{${extensions.join(",")}}`;
};

/**
 * ESLint configuration
 *
 * @param {import('typescript-eslint').InfiniteDepthConfigWithExtends[]} configs
 *
 * @returns {import('typescript-eslint').ConfigArray}
 */
const config = (...configs) => {
  const { dependencies, devDependencies } = config.packageJSON();

  const settings = {
    // next: "next" in dependencies || "next" in devDependencies,
    react: "react" in dependencies || "react" in devDependencies,
    typescript: "typescript" in dependencies || "typescript" in devDependencies,
  };

  const jsx = settings.react;

  const ts = settings.typescript;

  const tsx = settings.react && settings.typescript;

  const configArray = typescript.config(
    // @ts-expect-error
    [
      {
        languageOptions: {
          globals: {
            ...globals.node,
          },
        },
        linterOptions: {
          noInlineConfig: true,
          reportUnusedDisableDirectives: true,
        },
      },
      {
        files: [`**/*.${matchExtensions({ js: true, jsx, ts, tsx })}`],
        plugins: {
          import: imports,
          js: javascript,
          unicorn,
        },
        rules: {
          ...Object.fromEntries(
            Object.entries(javascript.configs.all.rules).map(([key, value]) => {
              switch (key) {
                case "one-var": {
                  return [key, ["error", "never"]];
                }

                case "sort-imports": {
                  return [key, ["error", { ignoreDeclarationSort: true }]];
                }

                case "capitalized-comments":
                case "max-lines-per-function":
                case "max-lines":
                case "no-ternary":
                case "no-undefined": {
                  return [key, "off"];
                }

                case "no-magic-numbers": {
                  return [key, "off"];
                }

                default: {
                  if (Object.keys(prettier.rules).includes(key)) {
                    return [key, "off"];
                  }

                  return [key, value];
                }
              }
            })
          ),
          ...Object.fromEntries(
            Object.entries(imports.rules)
              .filter(([, value]) => !value.meta?.deprecated)
              .map(([key]) => {
                switch (key) {
                  case "dynamic-import-chunkname":
                  case "enforce-node-protocol-usage":
                  case "no-named-export":
                  case "prefer-default-export": {
                    return [`import/${key}`, "off"];
                  }

                  default: {
                    if (Object.keys(prettier.rules).includes(key)) {
                      return [`import/${key}`, "off"];
                    }

                    return [`import/${key}`, "error"];
                  }
                }
              })
          ),
          ...Object.fromEntries(
            // @ts-expect-error
            Object.entries(unicorn.configs.all.rules).map(([key, value]) => {
              switch (key) {
                default: {
                  if (Object.keys(prettier.rules).includes(key)) {
                    return [key, "off"];
                  }

                  return [key, value];
                }
              }
            })
          ),
        },
      },

      ts && {
        files: [`**/*.${matchExtensions({ ts, tsx })}`],
        languageOptions: {
          parser: typescript.parser,
          sourceType: "module",
        },
        plugins: {
          "@typescript-eslint": typescript.plugin,
        },
        rules: {
          ...Object.fromEntries(
            [
              // @ts-expect-error
              ...Object.entries(typescript.configs.all[1].rules),
              // @ts-expect-error
              ...Object.entries(typescript.configs.all[2].rules),
            ].map(([key, value]) => {
              switch (key) {
                default: {
                  if (Object.keys(prettier.rules).includes(key)) {
                    return [key, "off"];
                  }

                  return [key, value];
                }
              }
            })
          ),
        },
      },

      {
        files: ["eslint.config.js"],
        rules: {
          ...preferDefaultExports,
        },
      },

      {
        files: ["jest.config.js"],
        rules: {
          ...preferDefaultExports,
        },
      },
      ...configs,
    ].filter(Boolean)
  );

  return configArray;
};

config.packageJSON = lookupPackageJson;

export { config, constants, preferDefaultExports, preferNamedExports };

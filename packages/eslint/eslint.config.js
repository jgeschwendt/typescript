import { config } from "./index.js";

export default config([
  {
    files: ["**/*.js"],
    rules: {
      "import/extensions": "warn",
      "import/no-nodejs-modules": "warn",
      "import/no-relative-parent-imports": "warn",
      "import/no-unresolved": "warn",
    },
  },
]);

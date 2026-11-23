---
'@jlg/oxlint': patch
---

`@jlg/oxlint`: `import-js/no-unresolved` is off: its resolver ignores `exports` maps, so an exports-only package never resolved. `unicorn-js/prefer-options-parameter` is on; `unicorn-js/prefer-regexp-exec` is on for JavaScript files, where native `typescript/prefer-regexp-exec` does not run; `unicorn-js/require-spread-parentheses` is off, oxfmt writes those parentheses. Native `typescript/no-unsafe-class-instance-assignment` is off on JavaScript files.

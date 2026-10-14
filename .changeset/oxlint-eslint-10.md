---
'@jlg/lint': minor
---

JS plugins move to ESLint 10 and eslint-plugin-unicorn ^77 (was pinned 60.0.0). Breaking for configs naming the old rules: `unicorn-js/prevent-abbreviations` is now `unicorn-js/name-replacements`, `unicorn-js/prefer-json-parse-buffer` is now `unicorn-js/consistent-json-file-read` (set to `"buffer"`, which now also flags a bare `readFileSync`), and `unicorn-js/better-regex` (removed upstream) and `import-js/no-unused-modules` (needs ESLint 9 internals) are gone. `unicorn-js/expiring-todo-comments` keeps date checks on; `unicorn-js/consistent-destructuring` now reports only members already destructured.

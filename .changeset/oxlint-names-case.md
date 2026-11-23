---
'@jlg/oxlint': patch
---

`@jlg/oxlint`: `names/case`, the house naming rule, replaces `typescript-js/naming-convention`, `eslint-js/camelcase` and native `no-underscore-dangle`, now off; it runs on JavaScript and TypeScript at error, keeps the per-kind cases and the `.jsx`/`.tsx` PascalCase permissions, lets a Next route export its HTTP-method handlers, and takes one option, `allow`. The `namingConvention` export is gone.

---
'@jlg/oxlint': patch
---

`@jlg/oxlint`: `names/case`, the house naming rule, replaces `typescript-js/naming-convention`, `eslint-js/camelcase` and native `no-underscore-dangle`, now off; it keeps the per-kind cases and the `.jsx`/`.tsx` PascalCase permissions, lets a Next route export its HTTP-method handlers, and takes one option, `allow`.

Breaking: it runs on JavaScript and TypeScript at error where naming-convention warned, and it checks every import binding, renamed named imports included, so `import Anthropic from '@anthropic-ai/sdk'`, `import * as Sentry from '@sentry/node'` and `import { Foo as Bar } from './foo'` now fail outside `.jsx`/`.tsx` until each name is in `allow`. The `namingConvention` export is gone, and `typescript-js/naming-convention` is no longer registered: a config that imports `namingConvention` or names the rule fails to load. To migrate, drop both and move each exception into `names/case`'s `allow`.

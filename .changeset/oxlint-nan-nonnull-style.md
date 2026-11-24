---
'@jlg/oxlint': patch
---

`@jlg/oxlint`: native `unicorn/prefer-number-properties` runs with `checkNaN: false`, upstream unicorn's default, so it agrees with `unicorn-js/prefer-global-number-constants` on writing `NaN`; a consumer that turned `unicorn-js/prefer-global-number-constants` off over the clash can delete that opt-out and write `NaN`, `Infinity` and `-Infinity`. `typescript/non-nullable-type-assertion-style` is off: it only chose between `x!` and `x as T`, two unchecked spellings, while `typescript/no-non-null-assertion` forbids the first and `typescript/no-unsafe-type-assertion` polices the second; opt-outs of it can go.

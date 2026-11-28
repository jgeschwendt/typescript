---
'@jlg/hud': patch
---

`@jlg/hud`: the review server live-reloads. The served dir and each repeatable `--watch <dir>` are watched; a changed `.css` swaps its stylesheet in place, anything else reloads the page with its scroll kept, over a `{"reload": path}` frame on `/__hud/ws`.

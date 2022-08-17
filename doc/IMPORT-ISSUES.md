## How to import common-js dependency using ES6 syntax
---
Until [#6632](https://github.com/vitejs/vite/issues/6632) is fixed, such imports should be done as follows:

```ts
import * as pkg from "off-color";
// @ts-ignore 
const offColor = pkg.offColor ?? pkg.default.offColor;
```

This way build, dev server and unit tests should all work.

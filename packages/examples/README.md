# node-wot Examples

The idea of this package is to use TypeScript to work on the examples which offers support in being up-to-date with the current API.

see https://github.com/eclipse/thingweb.node-wot/issues/171.

## Workflow

1. Run `npm run build`
2. Remove the following 3/4 lines in JS files of folder `dist/` 
```
Object.defineProperty(exports, "__esModule", { value: true });
require("wot-typescript-definitions");
let WoT;
let WoTHelpers;
```

3. Copy the file(s) to `<node-wot>/examples/`
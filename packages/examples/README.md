# node-wot Examples

## Examples

Examples are located in

- `src\scripts`
- `src\testthing`
- ...

The idea of these folders is to use TypeScript to work on the examples which offers support in being up-to-date with the current API.

see https://github.com/eclipse-thingweb/node-wot/issues/171.

## Workflow for generating JS examples

1. Run `npm run build`

2. Copy the according JS file(s) from `<node-wot>/packages/examples/dist` to

- `<node-wot>/examples/scripts`
- `<node-wot>/examples/testthing`
- ...

3. Run `npm run format`

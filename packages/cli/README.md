# Command-line interface (CLI) of node-wot

Current Maintainer(s): [@relu91](https://github.com/relu91) [@danielpeintner](https://github.com/danielpeintner) [@mkovatsc](https://github.com/mkovatsc)

## Getting Started

### Installation

-   `npm install @node-wot/cli`
-   You can alternatively install the node-wot CLI, either globally (`npm i @node-wot/cli -g`) or as
    a (dev) dependency (`npm i @node-wot/cli --save` or `npm i @node-wot/cli --save-dev`).

### Usage

With the CLI, you don't need to specify any further node-wot dependencies and can implement your application
(e.g., `main.js`) without explicitly requiring node-wot dependencies:

```JavaScript
// No need to require node-wot components
// WoT runtime is provided as global object

WoT.produce({/*.....*/})
```

If the CLI is globally installed, you don't need to set up a Node.js project.
If you do so, anyway, you can specify the entry point as follows:

```JavaScript
"scripts":{
   "start": "wot-servient main.js"
}
```

There are several ways to start the application:

a. Execute `npm start`.
b. Execute `./node_modules/.bin/wot-servient main.js`.
c. Execute `node ./node_modules/@node-wot/cli/dist/cli.js main.js`.
d. If you have installed `@node-wot/cli` globally you can even start the application right
away using this command `wot-servient main.js`. However, in the current implementation, the
import of local dependencies is not supported in this case.

wot-servient can execute multiple files at once, for example as follows:

```
wot-servient script1.js ./src/script2.js
```

### Configuration

The `-h` option explains the functionality and also how node-wot can be configured based on `wot-servient.conf.json`.

-   `wot-servient -h` _or_
-   `node packages\cli\dist\cli.js`

The `-h` help option shows the following output:

```
Usage: wot-servient [options] [command] [files...]


Run a WoT Servient in the current directory.


Arguments:
  files                           script files to execute. If no script is given, all .js files in the current directory are loaded. If one or more script is given, these files are loaded instead of the directory.

Options:
  -v, --version                   display node-wot version
  -c, --client-only               do not start any servers (enables multiple instances without port conflicts)
  -ll, --logLevel <string>        choose the desired log level. WARNING: if DEBUG env variable is specified this option gets overridden. (choices: "debug", "info", "warn", "error")
  -f, --config-file <file>        load configuration from specified file (default: $(pwd)/wot-servient.conf.json
  -p, --config-params <param...>  override configuration parameters [key1:=value1 key2:=value2 ...] (e.g. http.port:=8080)
  -h, --help                      show this help

Commands:
  schema                          prints the json schema for the configuration file

Configuration

Settings can be applied through three methods, in order of precedence (highest to lowest):

1.  Command-Line Parameters (-p path.to.set=value)
2.  Environment Variables (NODE_WOT_PATH_TO_SET=value) (supports .env files too)
3.  Configuration File

For the complete list of available configuration fields and their data types, run:

wot-servient schema

In your configuration files you can the following to enable IDE config validation:

{
    "$schema": "./node_modules/@node-wot/cli/dist/wot-servient-schema.conf.json"
    ...
}
```

Additionally, you can look at [the JSON Schema](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/cli/src/wot-servient-schema.conf.json) to understand possible values for each field.

> In the current implementation, the **middleware** option (that you can use to handle raw HTTP requests _before_ they hit the Servient) is only available when using the `@node-wot/binding-http` package as a library. See [Adding a middleware](../binding-http/README.md#adding-a-middleware) for more information.

### Environment variables

If your scripts needs to access environment variables those must be supplied in a particular file. Node-wot cli uses [dotenv](https://github.com/motdotla/dotenv) library to load `.env` files located at the current working directory. For example, providing the following `.env` file will fill variables `PORT` and `ADDRESS` in scripts `process.env` field:

```
PORT=4242
ADDRESS=http://hello.com
```

### Debugging

To debug, use the option `--inspect` or `--inspect-brk` if you want to hang until your debug client is connected. Then start [Chrome Dev Tools](chrome://inspect) or [vscode debugger](https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_attaching-to-nodejs) or your preferred v8 inspector to debug your code.

For further details check: `wot-servient --help`

### Examples

See [node-wot examples using Node.js](https://github.com/eclipse-thingweb/node-wot/#no-time-for-explanations---show-me-a-running-example).

## More Details

See <https://github.com/eclipse-thingweb/node-wot/>

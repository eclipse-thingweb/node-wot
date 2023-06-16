# Command-line interface (CLI) of node-wot

Current Maintainer(s): @relu91 @danielpeintner @mkovatsc

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

The `-h` help options shows the following output:

```
Usage: wot-servient [options] [files...]


Run a WoT Servient in the current directory.


Arguments:
  files                             script files to execute. If no script is given, all .js files in the current directory are
                                    loaded. If one or more script is given, these files are loaded instead of the directory.

Options:
  -v, --version                     display node-wot version
  -i, --inspect [host]:[port]       activate inspector on host:port (default: 127.0.0.1:9229)
  -ib, --inspect-brk [host]:[port]  activate inspector on host:port (default: 127.0.0.1:9229)
  -c, --client-only                 do not start any servers (enables multiple instances without port conflicts)
  -cp, --compiler <module>          load module as a compiler
  -f, --config-file <file>          load configuration from specified file (default: "wot-servient.conf.json")
  -p, --config-params <param...>    override configuration paramters [key1:=value1 key2:=value2 ...] (e.g. http.port:=8080)
  -h, --help                        show this help

wot-servient.conf.json syntax:
{
    "servient": {
        "clientOnly": CLIENTONLY,
        "staticAddress": STATIC,
        "scriptAction": RUNSCRIPT
    },
    "http": {
        "port": HPORT,
        "proxy": PROXY,
        "allowSelfSigned": ALLOW
    },
    "mqtt" : {
        "broker": BROKER-URL,
        "username": BROKER-USERNAME,
        "password": BROKER-PASSWORD,
        "clientId": BROKER-UNIQUEID,
        "protocolVersion": MQTT_VERSION
    },
    "credentials": {
        THING_ID1: {
            "token": TOKEN
        },
        THING_ID2: {
            "username": USERNAME,
            "password": PASSWORD
        }
    }
}

wot-servient.conf.json fields:
  CLIENTONLY      : boolean setting if no servers shall be started (default=false)
  STATIC          : string with hostname or IP literal for static address config
  RUNSCRIPT       : boolean to activate the 'runScript' Action (default=false)
  HPORT           : integer defining the HTTP listening port
  PROXY           : object with "href" field for the proxy URI,
                                "scheme" field for either "basic" or "bearer", and
                                corresponding credential fields as defined below
  ALLOW           : boolean whether self-signed certificates should be allowed
  BROKER-URL      : URL to an MQTT broker that publisher and subscribers will use
  BROKER-UNIQUEID : unique id set by MQTT client while connecting to the broker
  MQTT_VERSION    : number indicating the MQTT protocol version to be used (3, 4, or 5)
  THING_IDx       : string with TD "id" for which credentials should be configured
  TOKEN           : string for providing a Bearer token
  USERNAME        : string for providing a Basic Auth username
  PASSWORD        : string for providing a Basic Auth password
  ---------------------------------------------------------------------------

Environment variables must be provided in a .env file in the current working directory.

Example:
VAR1=Value1
VAR2=Value2
```

Additionally, you can look at [the JSON Schema](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/cli/src/wot-servient-schema.conf.json) to understand possible values for each field.

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

See [node-wot examples using Node.js](https://github.com/eclipse/thingweb.node-wot/#no-time-for-explanations---show-me-a-running-example).

## More Details

See <https://github.com/eclipse/thingweb.node-wot/>

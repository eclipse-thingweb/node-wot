# Command-line interface (CLI) of node-wot

## Getting Started

The following examples show how to use `wot-servient` based CLI.
The `-h` option explains the functionality and also how node-wot can be configured based on `wot-servient.conf.json`.

* `wot-servient -h` *or*
* `node packages\cli\dist\cli.js`

The `-h` help options shows the following output:

```
Usage: wot-servient [options] [SCRIPT]...
       wot-servient
       wot-servient examples/scripts/counter.js examples/scripts/example-event.js
       wot-servient -c counter-client.js
       wot-servient -f ~/mywot.conf.json examples/testthing/testthing.js

Run a WoT Servient in the current directory.
If no SCRIPT is given, all .js files in the current directory are loaded.
If one or more SCRIPT is given, these files are loaded instead of the directory.
If the file 'wot-servient.conf.json' exists, that configuration is applied.

Options:
  -v,  --version                   display node-wot version
  -i,  --inspect[=[host:]port]     activate inspector on host:port (default: 127.0.0.1:9229)
  -ib, --inspect-brk[=[host:]port] activate inspector on host:port and break at start of user script
  -c,  --clientonly                do not start any servers
                                   (enables multiple instances without port conflicts)
  -f,  --configfile <file>         load configuration from specified file
  -h,  --help                      show this help

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
    "log": {
        "level": LEVEL
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
  ---------------------------------------------------------------------------
  All entries in the config file structure are optional
  ---------------------------------------------------------------------------
  CLIENTONLY      : boolean setting if no servers shall be started (default=false)
  STATIC          : string with hostname or IP literal for static address config
  RUNSCRIPT       : boolean to activate the 'runScript' Action (default=false)
  HPORT           : integer defining the HTTP listening port
  PROXY           : object with "href" field for the proxy URI,
                                "scheme" field for either "basic" or "bearer", and
                                corresponding credential fields as defined below
  ALLOW           : boolean whether self-signed certificates should be allowed
  BROKER-URL      : URL to an MQTT broker that publisher and subscribers will use
  BROKER-UNIQUEID : unique id set by mqtt client while connecting to broker
  MQTT_VERSION    : number indicating the MQTT protocol version to be used (3, 4, or 5)
  LEVEL           : string or number setting the log level: { error: 0, warn: 1, info: 2, debug: 3 } (default info)
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

### Prerequisites
See instructions [how to build node-wot as a standalone application](https://github.com/eclipse/thingweb.node-wot/#as-a-standalone-application).

### Environment variables
If your scripts needs to access environment variables those must be supplied in a particular file. Node-wot cli uses [dotenv](https://github.com/motdotla/dotenv) library to load `.env` files located at the current working directory. For example, providing the following `.env` file will fill variables `PORT` and `ADDRESS` in scripts `process.env` field:

```
PORT=4242
ADDRESS=http://hello.com
```  

### Examples

See [node-wot examples using Node.js]( https://github.com/eclipse/thingweb.node-wot/#no-time-for-explanations---show-me-a-running-example).




### More Details

see https://github.com/eclipse/thingweb.node-wot/

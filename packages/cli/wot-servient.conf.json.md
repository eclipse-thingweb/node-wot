# Configuration of WoT Servient

File "wot-servient.conf.json"

```
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
```

CLIENTONLY is a boolean telling whether to start server part or not

STATIC is a string indicating a static hostname / IP address

RUNSCRIPT is a boolean indicating whether to provide the 'runScript' Action

HPORT is a number defining the HTTP listening port

PROXY is an object with `"href"` for the proxy URI, `"authorization"` for `"Basic"` or `"Bearer"`, and then corresponding credential fields `"username"`/`"password"` or `"token"` as defined below

ALLOW is a boolean indicating whether self-signed certificates should be allowed

BROKER-URL is a string indicating the MQTT broker URL with optional port number (default :1883)

BROKER-USERNAME is a string indicating the MQTT broker username

BROKER-PASSWORD is a string indicating the MQTT broker password

BROKER-UNIQUEID is a string indicating an optional MQTT broker unique ID

MQTT_VERSION is a number indicating the MQTT protocol version to be used (3, 4, or 5)

LEVEL is a string or number to set the logging level: `{ error: 0, warn: 1, info: 2, debug: 3 }` (default `info`)

THING_IDx is a TD @id for which credentials should be configured

TOKEN is an OAuth (Bearer) token

USERNAME is an HTTP Basic Auth username

PASSWORD is an HTTP Basic Auth password

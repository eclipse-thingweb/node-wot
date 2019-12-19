# Configuration of WoT Servient

File "wot-servient.conf.json"

```
{
    "servient": {
        "scriptDir": AUTORUN,
        "scriptAction": RUNSCRIPT
    },
    "http": {
        "port": HPORT,
        "proxy": PROXY,
        "allowSelfSigned": ALLOW
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

AUTORUN is a path string for the directory to load at startup

RUNSCRIPT is a boolean indicating whether to provide the 'runScript' Action

HPORT is a number defining the HTTP listening port

PROXY is an object with `"href"` for the proxy URI, `"authorization"` for `"Basic"` or `"Bearer"`, and then corresponding credential fields `"username"`/`"password"` or `"token"` as defined below

ALLOW is a boolean indicating whether self-signed certificates should be allowed

LEVEL is a string or number to set the logging level: `{ error: 0, warn: 1, info: 2, log: 3, debug: 4 }`

THING_IDx is a TD @id for which credentials should be configured

TOKEN is an OAuth (Bearer) token

USERNAME is an HTTP Basic Auth username

PASSWORD is an HTTP Basic Auth password

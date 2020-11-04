# HTTP Protocol Binding of node-wot

## Protocol specifier

The protocol prefix handled by this binding is `http://` or `https://`.

## Getting Started

In the following examples it is shown how to use the HTTP binding of node-wot.

### Prerequisites
* `npm install @node-wot/core`
* `npm install @node-wot/binding-http`

### Client Example

The client example tries to connect to a TestThing via HTTP and reads a property `string`. The ThingDescription is located under the follwing uri http://plugfest.thingweb.io:8083/testthing.

`node example-client.js`

```js
// example-client.js
Servient = require("@node-wot/core").Servient
HttpClientFactory = require("@node-wot/binding-http").HttpClientFactory

Helpers = require("@node-wot/core").Helpers

// create Servient and add HTTP binding
let servient = new Servient();
servient.addClientFactory(new HttpClientFactory(null));

let wotHelper = new Helpers(servient);
wotHelper.fetch("http://plugfest.thingweb.io:8083/testthing").then(async (td) => {
    // using await for serial execution (note 'async' in then() of fetch())
    try {
        servient.start().then((WoT) => {
            WoT.consume(td).then((thing) => {
                // read a property "string" and print the value
                thing.readProperty("string").then((s) => {
                    console.log(s);
                });
            });
        });
    } catch (err) {
        console.error("Script error:", err);
    }
}).catch((err) => { console.error("Fetch error:", err); });
```

### Server Example

The server example produces a thing that allows for setting a property `count`. The thing is reachable through HTTP. Additional additional handlers could be added.

`node example-server.js`

```js
// example-server.js
Servient = require("@node-wot/core").Servient
HttpServer = require("@node-wot/binding-http").HttpServer

Helpers = require("@node-wot/core").Helpers

// create Servient add HTTP binding with port configuration
let servient = new Servient();
servient.addServer(new HttpServer({
    port: 8081 // (default 8080)
}));

servient.start().then((WoT) => {
    WoT.produce({
        "@context": "https://www.w3.org/2019/wot/td/v1",
        title: "MyCounter",
        properties: {
            count: {
                type: "integer"
            }
        }
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);
        thing.writeProperty("count", 0)

        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.readProperty("count").then((c) => {
                console.log("cound is " + c);
            });
        });
    });
});
```

The *secure* server example shows how to add credentials and how to setup HTTPS.

`node example-server-secure.js`

```js
// example-server-secure.js
Servient = require("@node-wot/core").Servient
HttpServer = require("@node-wot/binding-http").HttpServer

Helpers = require("@node-wot/core").Helpers

// create secure Servient with username & password credentials 
let servient = new Servient();
servient.addCredentials({
    "urn:dev:wot:org:eclipse:thingweb:my-example-secure": {
        username: "node-wot",
        password: "hello"
        // token: "1/mZ1edKKACtPAb7zGlwSzvs72PvhAbGmB8K1ZrGxpcNM"
    }
});
let httpConfig = {
    allowSelfSigned: true, // client configuration
    serverKey: "privatekey.pem",
    serverCert: "certificate.pem",
    security: {
          scheme: "basic" // (username & password)
    }};
// add HTTPS binding with configuration
servient.addServer(new HttpServer(httpConfig));

servient.start().then((WoT) => {
    WoT.produce({
        "@context": "https://www.w3.org/2019/wot/td/v1",
        id: "urn:dev:wot:org:eclipse:thingweb:my-example-secure",
        title: "MyCounter",
        properties: {
            count: {
                type: "integer"
            }
        }
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);
        thing.writeProperty("count", 0)

        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.readProperty("count").then((c) => {
                console.log("cound is " + c);
            });
        });
    });
});
```

## Configuration
The protocol binding can be configured using his constructor or trough servient config file. The `HTTPConfig` object contains a set of useful parameters: 
```ts
{
    port?: number;                  // TCP Port to listen on
    address?: string;               // IP address or hostname of local interface to bind to
    proxy?: HttpProxyConfig;        // proxy configuration
    allowSelfSigned?: boolean;      // Accept self signed certificates
    serverKey?: string;             // HTTPs server secret key file
    serverCert?: string;            // HTTPs server certificate file
    security?: TD.SecurityScheme;   // Security scheme of the server
    baseUri?: string                // A Base URI to be used in the TD in cases where the client will access a different URL than the actual machine serving the thing.  [See Using BaseUri below]
}
```
When both `serverKey` and `serverCert` are defined the server is started in `https` mode. Examples of `serverKey` and `serverCert` can be found [here](../../examples/security). Moreover, when a security schema is provided the servient must be also configured with valid credentials both client and server side. See [Security](#Security) for further details.

### Environment Variable Overrides
HttpServer will check the environment variables `WOT_PORT`, then `PORT`.  If either are set, they will override the port the HttpServer will bind to.  

You'll see log entries indicating this:

`[binding-http] HttpServer Port Overridden to 1337 by Environment Variable WOT_PORT`

These are useful on Heroku, Dokku, buildpack deployment, or Docker, etc.

> `WOT_PORT` takes higher precedence than `PORT`

### HttpProxyConfig
```ts
{
    href: string;                   // Proxy address
    scheme?: "basic" | "bearer";    // Security scheme used by the proxy
    token?: string;                 // Bearer token (valid only with scheme = "bearer") 
    username?: string;              // Username security parameter (valid only with scheme = "basic")
    password?: string;              // Password security parameter (valid only with scheme = "basic")
}
```

## Security
The http protocol binding supports a set of security protocols that can be enabled via servient configuration. As shown in the example section here is a configuration for a basic secure scheme:
```js
{
    http: {
        port: 8080,
        allowSelfSigned: true,
        serverKey: "privatekey.pem",
        serverCert: "certificate.pem",
        security: {
            scheme: "basic" // (username & password)
        }
    }
    credentials: {
        "urn:dev:wot:org:eclipse:thingweb:my-example-secure": {
            username: "node-wot",
            password: "hello"
        }
    }
}
```
The above configuration file, is setting up a https server with basic secure scheme. To interact with `urn:dev:wot:org:eclipse:thingweb:my-example-secure` (i.e. read a property) username and password must be provided and should be equal to *node-wot* and *hello*. Consequently, on the client side, the same credentials should be provided:
```js
{
    servient: {
        clientOnly: true,
    },
    http:{
        allowSelfSigned: true
    },
    credentials: {
        "urn:dev:wot:org:eclipse:thingweb:my-example-secure": {
            username: "node-wot",
            password: "hello"
        }
    }
}
```

### oAuth2.0
Currently this binding supports only oAuth2.0 `client credential` and `Resource owner credential` flows. Other flows may be implemented in future like `code` flow. Futhermore, the oAuth2.0 protocol is only implemented for the client side.

An example of a WoT oAuth2.0 enabled client can be found [here](../examples/src/security/oauth/README.md).


### Using baseUri

Assume the example [WoT coffee machine](../examples/src/scripts/coffee-machine.ts) is in the W3C's office kitchen connected to the W3C's private network.  It allows you to start the coffee machine before you leave home so it will be ready when you get to work.

Inside the W3C's private network the coffee machine can found at:
<br/>`https://internal-host:8080/smart-coffee-machine`

From your home, it can be addressed via an Internet accessible domain name: 
<br/>`https://coffee.w3.org/things/smart-coffee-machine`



__HttpServer Configuration__

```js
servient.addServer(new HttpServer({
    port: 8080, // (default 8080)
    baseUri: 'https://coffee.w3.org/things'
}));
```

__External Gateway Configuration__

The DNS name`coffee.w3.org` resolves to an elastic IP on a gateway using nginx, which has this rule configured. 

```
location /things/ {
    proxy_pass https://internal-host:8080/smart-coffee-machine
}
```

The exposed thing on the internal server will product form URLs such as:

```json 
 "actions": {
    "makeDrink": {
      "forms": [
        {
          "href": "https://wot.w3.org/things/smart-coffee-machine/actions/makeDrink"
```
__baseUrt vs address__

> `baseUri` tells the producer to prefix URLs which may include hostnames, network interfaces, and URI prefixes which are not local to the machine exposing the Thing.
> `address` tells the HttpServer a specific ocal network interface to bind its TCP listener. 


## Feature matrix

|Operation | HTTP Producer | HTTP Consumer | 
| :---        |    :----:   |  :---: |
| readproperty | Y | Y | 
| writeproperty | Y | Y |
| observeproperty | Y | Y | 
| unobserveproperty | ? | ? |
| readallproperties | Y | Y |  
| writeallproperties | Y | Y |  
| readmultipleproperties | Y | Y | 
| writemultipleproperties | Y | Y | 
| invokeaction | Y | Y | 
| subscribeevent | Y | Y |  
| unsubscribeevent | ? | ? | 

| SubProtocols | HTTP Producer | HTTP Consumer | 
| :---        |    :----:   |  :---: | 
| longpoll | Y | Y | 
| sse | Y | Y | 
| websub | N | N | 

| Sec. Schemes | HTTP Producer | HTTP Consumer | 
| :---        |    :----:   |  :---: |
| basic | Y | Y |
| digest | N | N |
| apikey | N | Y |  
| bearer | Y | Y |
| psk | N | N | 
| oauth2 | P | Y | 

**Symbols** :
- Y  implemented
- N  not implement and not planned
- N.A not applicable
- ? need to be verified
- P planned
## More Details

see https://github.com/eclipse/thingweb.node-wot/

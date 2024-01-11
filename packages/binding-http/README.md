# HTTP Protocol Binding of node-wot

W3C WoT Binding Template specification for HTTP can be found [here](https://w3c.github.io/wot-binding-templates/bindings/protocols/http/index.html).

Current Maintainer(s): [@relu91](https://github.com/relu91) [@danielpeintner](https://github.com/danielpeintner)

## Protocol specifier

The protocol prefix handled by this binding is `http://` or `https://`.

## Getting Started

In the following examples, how to use the HTTP binding of node-wot is shown.

### Prerequisites

-   `npm install @node-wot/core`
-   `npm install @node-wot/binding-http`

### Client Example

The client example tries to connect to a TestThing via HTTP and reads the `string` property.
The Thing Description is located under the following uri <http://plugfest.thingweb.io:8083/testthing>.

`node example-client.js`

```js
// example-client.js
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

// create Servient and add HTTP binding
const servient = new Servient();
servient.addClientFactory(new HttpClientFactory(null));

servient
    .start()
    .then(async (WoT) => {
        try {
            const td = await WoT.requestThingDescription("http://plugfest.thingweb.io:8083/testthing");
            const thing = await WoT.consume(td);

            // read property
            const read1 = await thing.readProperty("string");
            console.log("string value is: ", await read1.value());
        } catch (err) {
            console.error("Script error:", err);
        }
    })
    .catch((err) => {
        console.error("Start error:", err);
    });
```

### Server Example

The server example produces a thing that allows for setting a property `count`. The thing is reachable through HTTP.

`node example-server.js`

```js
// example-server.js
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

// create Servient add HTTP binding with port configuration
const servient = new Servient();
servient.addServer(
    new HttpServer({
        port: 8081, // (default 8080)
    })
);

let count;

servient.start().then((WoT) => {
    WoT.produce({
        title: "MyCounter",
        properties: {
            count: {
                type: "integer",
            },
        },
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);

        // init property value
        count = 0;
        // set property handlers (using async-await)
        thing.setPropertyReadHandler("count", async () => count);
        thing.setPropertyWriteHandler("count", async (intOutput, options) => {
            count = await intOutput.value();
            return undefined;
        });

        // expose the thing
        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
        });
    });
});
```

The _secure_ server example shows how to add credentials and how to set up HTTPS.

`node example-server-secure.js`

```js
// example-server-secure.js
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

// create secure Servient with username & password credentials
const servient = new Servient();
servient.addCredentials({
    "urn:dev:wot:org:eclipse:thingweb:my-example-secure": {
        username: "node-wot",
        password: "hello",
        // token: "1/mZ1edKKACtPAb7zGlwSzvs72PvhAbGmB8K1ZrGxpcNM"
    },
});
const httpConfig = {
    allowSelfSigned: true, // client configuration
    serverKey: "privatekey.pem",
    serverCert: "certificate.pem",
    security: [
        {
            scheme: "basic", // (username & password)
        },
    ],
};
// add HTTPS binding with configuration
servient.addServer(new HttpServer(httpConfig));

let count;

servient.start().then((WoT) => {
    WoT.produce({
        title: "MyCounter",
        properties: {
            count: {
                type: "integer",
            },
        },
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);

        // init property value
        count = 0;
        // set property handlers (using async-await)
        thing.setPropertyReadHandler("count", async () => count);
        thing.setPropertyWriteHandler("count", async (intOutput, options) => {
            count = await intOutput.value();
            return undefined;
        });

        // expose the thing
        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
        });
    });
});
```

## Configuration

The protocol binding can be configured using his constructor or trough servient config file. The `HTTPConfig` object contains a set of useful parameters:

```ts
{
    port?: number;                           // TCP Port to listen on
    address?: string;                        // IP address or hostname of local interface to bind to
    proxy?: HttpProxyConfig;                 // proxy configuration
    allowSelfSigned?: boolean;               // Accept self signed certificates
    serverKey?: string;                      // HTTPs server secret key file
    serverCert?: string;                     // HTTPs server certificate file
    security?: TD.SecurityScheme[];          // A list of possible security schemes to be used by things exposed by this servient.
    baseUri?: string                         // A Base URI to be used in the TD in cases where the client will access a different URL than the actual machine serving the thing.  [See Using BaseUri below]
    urlRewrite?: Record<string, string>      // A record to allow for other URLs pointing to existing endpoints, e.g., { "/myroot/myUrl": "/test/properties/test" }
    middleware?: MiddlewareRequestHandler;   // the MiddlewareRequestHandler function. See [Adding a middleware] section below.
}
```

When both `serverKey` and `serverCert` are defined the server is started in `https` mode. Examples of `serverKey` and `serverCert` can be found [here](../../examples/security). Moreover, when a security schema is provided the servient must be also configured with valid credentials both client and server side. See [Security](#Security) for further details.

### Environment Variable Overrides

HttpServer will check the environment variables `WOT_PORT`, then `PORT`. If either are set, they will override the port the HttpServer will bind to.

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
        security: [{
            scheme: "basic" // (username & password)
        }]
    }
    credentials: {
        "urn:dev:wot:org:eclipse:thingweb:my-example-secure": {
            username: "node-wot",
            password: "hello"
        }
    }
}
```

The above configuration file, is setting up a https server with basic secure scheme. To interact with `urn:dev:wot:org:eclipse:thingweb:my-example-secure` (i.e. read a property) username and password must be provided and should be equal to _node-wot_ and _hello_. Consequently, on the client side, the same credentials should be provided:

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

Currently this binding supports only oAuth2.0 `client credential` and `Resource owner credential` flows. Other flows may be implemented in future like `code` flow. Furthermore, the oAuth2.0 protocol is only implemented for the client side.

An example of a WoT oAuth2.0 enabled client can be found [here](../examples/src/security/oauth/README.md).

### Using baseUri

Assume the example [WoT coffee machine](../examples/src/scripts/coffee-machine.ts) is in the W3C's office kitchen connected to the W3C's private network. It allows you to start the coffee machine before you leave home so it will be ready when you get to work.

Inside the W3C's private network the coffee machine can found at:
<br/>`https://internal-host:8080/smart-coffee-machine`

From your home, it can be addressed via an Internet accessible domain name:
<br/>`https://coffee.w3.org/things/smart-coffee-machine`

**HttpServer Configuration**

```js
servient.addServer(
    new HttpServer({
        port: 8080, // (default 8080)
        baseUri: "https://coffee.w3.org/things",
    })
);
```

**External Gateway Configuration**

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

**baseUri vs address**

> `baseUri` tells the producer to prefix URLs which may include hostnames, network interfaces, and URI prefixes which are not local to the machine exposing the Thing.

> `address` tells the HttpServer a specific local network interface to bind its TCP listener.

### Adding a middleware

HttpServer supports the addition of **middleware** to handle the raw HTTP requests before they hit the Servient. In the middleware function, you can run some logic to filter and eventually reject HTTP requests (e.g. based on some custom headers).

This can be done by passing a middleware function to the HttpServer constructor.

```js
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

const servient = new Servient();

const middleware = async (req, res, next) => {
    // For example, reject requests in which the X-Custom-Header header is missing
    // by replying with 400 Bad Request
    if (!req.headers["x-custom-header"]) {
        res.statusCode = 400;
        res.end("Bad Request");
        return;
    }
    // Pass all other requests to the WoT Servient
    next();
};

const httpServer = new HttpServer({
    middleware,
});

servient.addServer(httpServer);

servient.start().then(async (WoT) => {
    // ...
});
```

## Feature matrix

| Operation               | HTTP Producer | HTTP Consumer |
| :---------------------- | :-----------: | :-----------: |
| readproperty            |       Y       |       Y       |
| writeproperty           |       Y       |       Y       |
| observeproperty         |       Y       |       Y       |
| unobserveproperty       |       ?       |       ?       |
| readallproperties       |       Y       |       Y       |
| writeallproperties      |       Y       |       Y       |
| readmultipleproperties  |       Y       |       Y       |
| writemultipleproperties |       Y       |       Y       |
| invokeaction            |       Y       |       Y       |
| subscribeevent          |       Y       |       Y       |
| unsubscribeevent        |       ?       |       ?       |

| SubProtocols | HTTP Producer | HTTP Consumer |
| :----------- | :-----------: | :-----------: |
| longpoll     |       Y       |       Y       |
| sse          |       Y       |       Y       |
| websub       |       N       |       N       |

| Sec. Schemes | HTTP Producer | HTTP Consumer |
| :----------- | :-----------: | :-----------: |
| basic        |       Y       |       Y       |
| digest       |       N       |       N       |
| apikey       |       N       |       Y       |
| bearer       |       Y       |       Y       |
| psk          |       N       |       N       |
| oauth2       |       P       |       Y       |

**Symbols** :

-   Y implemented
-   N not implement and not planned
-   N.A not applicable
-   ? need to be verified
-   P planned

## More Details

see https://github.com/eclipse-thingweb/node-wot/

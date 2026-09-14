# OPC UA Client Protocol Binding

W3C Web of Things (WoT) Protocol Binding for OPC UA.
This package uses [nodep-opcua](https://www.npmjs.com/package/node-opcua) as a low-level client for OPCUA over TCP.

Current Maintainer(s): [@erossignon](https://github.com/erossignon)

## Protocol specifier

The protocol prefix handled by this binding is `opc.tcp`.
This is the standard prefix used by OPC-UA connection endpoint.

## Getting Started

You can define an OPCUA property in a thing description, by using an "opc.tcp://" href.

```js
const thingDescription = {
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "@type": ["Thing"],
    securityDefinitions: { nosec_sc: { scheme: "nosec" } },
    security: "nosec_sc",
    title: "servient",
    description: "node-wot CLI Servient",
    properties: {
        pumpSpeed: {
            description: "the pump speed",
            type: "number",
            forms: [
                {
                    href: "opc.tcp://opcuademo.sterfive.com:26543?id=ns=1;s=PumpSpeed",
                    op: ["readproperty", "observeproperty"],
                },
            ],
        },
    },
};
```

```javascript
// examples/src/opcua/demo-opcua1.ts
import { Servient } from "@node-wot/core";
import { OPCUAClientFactory } from "@node-wot/binding-opcua";

import { thingDescription } from "./demo-opcua-thing-description";
(async () => {
    const servient = new Servient();
    servient.addClientFactory(new OPCUAClientFactory());

    const wot = await servient.start();
    const thing = await wot.consume(thingDescription);

    const content = await thing.readProperty("pumpSpeed");
    const pumpSpeed = await content.value();

    console.log("------------------------------");
    console.log("Pump Speed is : ", pumpSpeed, "m/s");
    console.log("------------------------------");

    await servient.shutdown();
})();
```

### Run the Example App

The `packages/examples/src/bindings/opcua` folder contains a set of typescript demo that shows you
how to define a thing description containing OPCUA Variables and methods.

-   `demo-opcua1.ts` shows how to define and read an OPC-UA variable in WoT.
-   `demo-opcua2.ts` shows how to subscribe to an OPC-UA variable in WoT.
-   `opcua-coffee-machine-demo.ts` demonstrates how to define and invoke OPCUA methods as WoT actions.

### Format for href

The `href` must contain an OPCUA endpoint url in the form of `opc.tcp://<address>:<port>/?id=<nodeId>`
such as for instance:
`opc.tcp://opcuademo.sterfive.com:26543?id=ns=1;s=PumpSpeed`

`<nodeId>` has the following expectations:

-   any hash character (`#`) must be URL encoded (`%23`)
-   any ampersand character (`&`) must be URL encoded (`%26`)

### defining a property

```javascript
const thingDescription = {
    // ...
    properties: {
        temperature: {
            description: "the temperature",
            observable: true,
            readOnly: true,
            unit: "m/s",
            type: "number",
            forms: [
                {
                    href: "opc.tcp://opcuademo.sterfive.com:26543?id=ns=1;s=Temperature",
                    op: ["readproperty", "observeproperty"],
                },
            ],
        },
    },
};
```

## Security

The security schemes accepted by this binding are those defined in
[OPC 10101 "OPC UA for WoT Binding"](https://reference.opcfoundation.org/specs/OPC-10101) §6.3.
There are three ways to describe an OPC UA connection:

-   `nosec` (§6.3.1) — the server has a single endpoint with no security at all.
-   `auto` (§6.3.2) — the server offers several endpoints, and the client selects one at
    connection time. See [Letting the binding choose](#letting-the-binding-choose--auto).
-   `uav:channelsec` and `uav:authentication` (§6.3.3) — the thing description states explicitly
    which security settings to use.

The last of these is two schemes rather than one, because OPC UA has two independent security
layers:

-   **channel security** (`uav:channelsec`) protects the _connection_ — whether messages are
    signed and/or encrypted, and with which cryptographic suite.
-   **authentication** (`uav:authentication`) identifies _who_ is connecting.

The two are orthogonal: an encrypted channel may carry an anonymous user, and a named user may
connect over a plain text channel. A thing description that needs both combines them with a
`combo` scheme, as shown further down.

Both schemes use the `uav` prefix, which must be bound in the `@context` of the thing description:

```javascript
const thingDescription = {
    "@context": ["https://www.w3.org/2019/wot/td/v1", { uav: "http://opcfoundation.org/UA/WoT-Binding/" }],
    // ...
};
```

### Channel security — `uav:channelsec`

| property             | value                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `uav:securityMode`   | `"None"`, `"Sign"` or `"SignAndEncrypt"`                                                              |
| `uav:securityPolicy` | the cryptographic suite, e.g. `"Basic256Sha256"`, `"Aes128_Sha256_RsaOaep"`, `"Aes256_Sha256_RsaPss"` |

Both terms are required by the specification. When `uav:securityMode` is `"None"` the policy
carries no information; this binding accepts `"uav:securityPolicy": "None"` and also tolerates its
absence. Conversely, `"None"` is refused when the mode asks for security, since it cannot satisfy
it. The policy may be written either as its short name, as above, or as its full URI
(`"http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"`), the latter being an extension.

A value of `uav:securityMode` or `uav:userIdentityToken` outside the set the specification defines
is an error, and the connection is refused. It is never treated as an unspecified default, which
would connect with less security than the thing description asked for.

```javascript
securityDefinitions: {
    channel_sc: {
        scheme: "uav:channelsec",
        "uav:securityMode": "SignAndEncrypt",
        "uav:securityPolicy": "Basic256Sha256",
    },
},
security: "channel_sc",
```

OPC 10101 names `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` and `Aes256_Sha256_RsaPss` as
the policies to use, and lists `Basic256` and `Basic128Rsa15` as outdated and not recommended.
Those two are deliberately left out of the TypeScript type, so a thing description written in
TypeScript will not compile if it uses them; they are not rejected at runtime, so a plain JSON
thing description may still request one and will connect. Do not rely on this, and prefer
`Basic256Sha256` or better.

As an extension beyond the specification, the binding also accepts any other policy known to
`node-opcua` — `Basic128`, `Basic192`, `Basic192Rsa15`, `Basic256Rsa15`. These are outside OPC
10101, so a thing description using them is not portable to another binding.

### Authentication — `uav:authentication`

| `uav:userIdentityToken` | credentials required                    |
| ----------------------- | --------------------------------------- |
| `"Anonymous"`           | none                                    |
| `"UserName"`            | `{ userName, password }`                |
| `"Certificate"`         | `{ certificate, privateKey }`, both PEM |

The scheme says only _which kind_ of identity to use. The identity itself is never written in the
thing description — see [Credentials](#credentials) below.

```javascript
securityDefinitions: {
    user_sc: {
        scheme: "uav:authentication",
        "uav:userIdentityToken": "UserName",
    },
},
security: "user_sc",
```

`"IssuedToken"` and its companion term `uav:issueToken` — which references a separate scheme such
as `oauth2` — are defined by OPC 10101 and are recognised by the binding, but cannot be used:
`node-opcua` does not support issued tokens yet, so a thing description requesting one is refused
with an explicit error rather than connected under a weaker identity.

### Credentials

OPC 10101 §6.3.2 and §6.3.3 both state that login credentials are _not_ shared in thing
descriptions and must be provided separately. They are therefore registered with the servient,
keyed by the **thing id**:

```javascript
const servient = new Servient();
servient.addClientFactory(new OPCUAClientFactory());
servient.addCredentials({
    "urn:my-opcua-thing": { userName: "joe", password: "secret" },
});
```

For a `Certificate` scheme, supply `{ certificate, privateKey }` instead, both in PEM form. When
several credentials are registered for one thing, the binding selects the entry that fits the
scheme, so a user name and a certificate may coexist.

A scheme whose credentials are missing is an error: the connection is refused rather than
downgraded to an anonymous session.

Since the thing description no longer carries any secret, it can be published and shared freely.

### Combining the two schemes

Because channel security and authentication are separate schemes, a thing description that needs
both declares each one and joins them with a `combo` scheme, as OPC 10101 §6.3.3 prescribes:

```javascript
securityDefinitions: {
    channel_sc: {
        scheme: "uav:channelsec",
        "uav:securityMode": "SignAndEncrypt",
        "uav:securityPolicy": "Basic256Sha256",
    },
    user_sc: {
        scheme: "uav:authentication",
        "uav:userIdentityToken": "UserName",
    },
    secure_sc: {
        scheme: "combo",
        allOf: ["channel_sc", "user_sc"],
    },
},
security: "secure_sc",
```

A scheme declared on its own leaves the other layer at its default, which is the least privileged
one: `uav:channelsec` alone connects anonymously, and `uav:authentication` alone connects over an
unsecured channel.

OPC 10101 only uses `allOf` here. This binding also accepts a `combo` scheme using `oneOf`, in
which case the first alternative is selected; that is an extension beyond the specification.

### Letting the binding choose — `auto`

`"scheme": "auto"` is the AutoSecurityScheme of OPC 10101 §6.3.2, and is the specification's
recommendation when the server exposes several endpoints with different settings. The client
executes the OPC UA `GetEndpoints` service and selects an endpoint from what the server advertises;
this binding picks the most secure channel on offer. It settles channel security only, so it is
normally combined with a `uav:authentication` scheme:

```javascript
securityDefinitions: {
    auto_sc: { scheme: "auto" },
    anonymous_sc: { scheme: "uav:authentication", "uav:userIdentityToken": "Anonymous" },
    secure_sc: { scheme: "combo", allOf: ["auto_sc", "anonymous_sc"] },
},
security: "secure_sc",
```

### Migrating from 0.9.2

Version 0.9.2 shipped provisional names, invented before OPC 10101 was published. They have been
replaced by the names the specification defines, and the old ones are no longer accepted — a thing
description that still uses them is rejected with an error, rather than being silently ignored and
connected without security. Use the table below to migrate.

| 0.9.2                                                       | OPC 10101 v1.00                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `"scheme": "uav:channel-security"`                          | `"scheme": "uav:channelsec"`                                            |
| `"messageMode": "none"` / `"sign"` / `"sign_encrypt"`       | `"uav:securityMode": "None"` / `"Sign"` / `"SignAndEncrypt"`            |
| `"policy": "..."`                                           | `"uav:securityPolicy": "..."`                                           |
| `"tokenType": "anonymous"` / `"username"` / `"certificate"` | `"uav:userIdentityToken": "Anonymous"` / `"UserName"` / `"Certificate"` |
| `"scheme": "uav:authentication"`                            | unchanged                                                               |

Credentials that used to sit inside the authentication scheme — `userName`, `password`,
`certificate`, `privateKey` — move out of the thing description entirely; see
[Credentials](#credentials).

## Advanced

The OPC-UA binding for node-wot offers additional features to allow you to interact with
OPCUA Variant and DataValue in OPCUA JSON encoded form.
For an example of use, you can dive into the unit test of the binding-opcua library.

### A worked security example

`packages/binding-opcua/test/opcua-security-e2e-test.ts` is a narrated tour of the security
schemes against a real OPC UA server. Each case builds one thing description, connects, and then
asks the server what session it actually granted — so it shows what happened on the wire rather
than what was requested. `packages/examples/src/bindings/opcua/demo-opcua-secure.ts` is the same
thing as a runnable script.

### Exploring the unit tests

A set of examples can be found in this unit test: packages\binding-opcua\test\full-opcua-thing-test.ts

## Additional tools

### basic OPC-UA demo server

A basic demo OPC-UA server can be started using the following command.

```
thingweb.node-wot> ts-node packages/binding-opcua/test/fixture/basic-opcua-server.ts
Server started opc.tcp://<YOURMACHINENAME>:7890
```

### awesome WoT - OPCUA tools

the [node-wot-opcua-tools](https://github.com/node-opcua/node-wot-opcua-tools) project provides
some useful applications built on top of node-wot and the OPCUA binding.

## Binding Examples

This folder contains examples for different binding protocols.

It demonstrates how to create Things that take their properties, actions, and events from different protocol bindings.

For each use case a Thing Description is provided that describes the Thing in a protocol-agnostic way.
Then a Servient is created that uses the respective binding protocol to expose the Thing.
A console client is also provided to interact with the Thing.

Examples are located in

-   `bindings\coap`
-   `bindings\http`
-   [`bindings\opcua`](./opcua/README.md)

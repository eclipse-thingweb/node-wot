# node-wot Demo Servients

## raspberry-servient

To be run on a Raspberry Pi with UnicornHAT LED shield.

## bridge-servient

A command line interface similar to "wot-servient" in the cli package.
It runs an HTTP server for local control and monitoring, but the main purpose is to open bridge connections to services with custom binding.
At the moment, the bridge-servient supports

-   the Fujitsu Remote Proxy bridge
-   the Oracle IoT Cloud Service bridge

The bridge-servient has several client bindings to act as local proxy that can consume several ecosystems.

Run with `bridge-servient -h` for more information.

Ensure that you called `npm run link` in the project root or `npm link` in packages/demo-servients/ (requires `sudo` under Linux).

## fujitsu-local-proxy

A test servient with hardwired application script.
It bridges a Festo mockup to the Fujitsu Remote Proxy.

## oracle-festo-proxy

A test servient with hardwired application script.
It bridges the Festo plant to the Oracle IoT Cloud Service.

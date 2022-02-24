# NETCONF Client Protocol Binding

W3C Web of Things (WoT) Protocol Binding for NETCONF [RFC6241](https://tools.ietf.org/html/rfc6241)

## Protocol specifier

The protocol prefix handled by this binding is `netconf://`.
## Getting Started

### Optional: NETCONF Server Simulator

If a NETCONF server is needed, the simulator [Netopeer2](https://github.com/CESNET/Netopeer2) can be used.
A Dockerfile for building the simulator Docker image can be found [here](https://github.com/opennetworkinglab/ODTN-emulator/blob/master/emulator-oc-cassini/Dockerfile), then just create a Docker image and launch the Docker container:

```bash
$ docker image build -t netconf
$ docker run -d --name NETCONF netconf
```

The Docker container for the Server Simulator already comes with the necessary YANG modules loaded.
Otherwise to manually install them just download the files and then:

```bash
$ sysrepoctl --install --yang=ietf-interfaces@2014-05-08.yang --owner=root:root --permissions=666
$ sysrepoctl --install --yang=ietf-ip@2014-06-16.yang --owner=root:root --permissions=666
$ sysrepoctl --install --yang=iana-if-type@2014-05-08.yang --owner=root:root --permissions=666
```

### Prepare the NETCONF Server

Three YANG files must be loaded by the server in order to be able to run the examples:

-   [ietf-interfaces@2014-05-08.yang](https://github.com/YangModels/yang/blob/master/standard/ietf/RFC/ietf-interfaces%402014-05-08.yang)
-   [ietf-ip@2014-06-16.yang](https://github.com/YangModels/yang/blob/master/standard/ietf/RFC/ietf-ip%402014-06-16.yang)
-   [iana-if-type@2014-05-08.yang](https://github.com/YangModels/yang/blob/master/standard/ietf/RFC/ietf-interfaces%402018-02-20.yang)

### Run the Example App

The Binding example in the `./examples` directory provides a TD (`netconf-thing.jsonld`) and an app script (`netconf-example.js`) .

Depending on which NETCONF server is used, the following might have to be changed:

-   IP address and port in `examples/netconf-thing.jsonld`
-   credentials for the NETCONF Thing (id `urn:dev:wot:org:eclipse:netconf-example`) have to be changed in `wot-servient.conf.json`.

## New Form Fields for the NETCONF Binding

### href

The href contains: URI schema + IP address + port + XPath

-   URI schema: the schema for NETCONF is not registered with IANA; the Binding is using `netconf`.
-   IP address and port: IP address and port of the NETCONF server. The credentials for the SSH connection to the server can be added into the `wot-servient.configuration.json`.
-   XPath: the XPath of the YANG model node addressed by the given InteractionAffordance. The XPath is automatically converted into the corrisponding XML needed by the RPC. If an attribute refers to a particular namespace, an alias can be used. The complete URN for the alias should be added to the **nc:NSs** field.

### nc:target

Since Netconf has to deal with multiple datastores, a new attribute has been added to the `form` to indicate which datastore shall be addressed.
There are three different datastores, and hence valid values for `nc:target`: `running`, `candidate`, and `startup`.
For handling different datastores, the same InteractionAffordance needs to be duplicated, specifying in the `nc:target` which datastore is actually addressed.
Of course, this does not seem enough for clarifying which datastore is addressed at the Affordance level, but currently the TD schema misses a way for expressing a semantic target identifier in such level.

### nc:NSs

Since every namespace is used in the XPath with an alias, its complete URN has to be added to an additional field of the Form.
`nc:NSs` in fact is a dictionary containing all the complete URNs for the YANG files used in that **href** for the server.
For the sake of ease, the keys of the dictionary are the aliases used in the XPath, and their values the complete URNs.

For example this `href`:

    netconf://172.17.0.2:830/ietf-interfaces:interfaces/interface[type=iana-if-type:modem]

requires this `nc:NSs` in the _Form_ field:

```json
"nc:NSs": {
    "ietf-interfaces": "urn:ietf:params:xml:ns:yang:ietf-interfaces",
    "iana-if-type": "urn:ietf:params:xml:ns:yang:iana-if-type"
}
```

### nc:method

The optional attribute _nc:method_ specifies which NETCONF RPC should be used in the request. By default:

-   readproperty is mapped to a NETCONF RPC with `GET-CONFIG` method
-   writepropery is mapped to a NETCONF RPC with `EDIT-CONFIG` method
-   invokeaction is mapped to the generic RPC call, and hence, the method must be set explicitly (e.g., `COMMIT`, or whatever RPC is defined in YANG).

## New DataSchema Fields for the NETCONF Binding and new ContentSerdes

NETCONF uses XML on the wire, which requires additional translations from the JSON model used at WoT application level.
To enable support for XML attributes (e.g., `<node myattrib="demo">myvalue</node>`), the DataSchema information has to be extended with the following terms, and a new ContentSerdes is needed.

### xml:container and xml:attribute

The field `nc:container` is used in combination with `nc:attribute` to indicate whether the object is a structure or a node with attributes (`"nc:container": true`), and whether the given property is an attribute `"nc:attribute": true`) or the value, resp.
The concrete use case is to assign a namespace passed as attribute (`xmlns`) to the value inside the XML node.
Here, the object should contain two properties, one for specifying the namespace (e.g., `xmlns` with `"nc:attribute": true`), and the other for the value (e.g., `value` with `"nc:attribute": false` or rather just omitted as `false` is the default value).

For example, assume the YANG leaf **type** modeled as a Property with the following **href**:

`netconf://172.17.0.2:830/ietf-interfaces:interfaces/interface[name=interface100]/type`

According to the YANG model, the value for **type** requires a value that is qualified by a namespace.
In XML, it is given through the `xmlns` attribute of the `type` node.
Using the JSON model of TD, it looks like the following, where the `xmlns` key will be used as attribute name and the `value` key ignored, as it is the value going into the XML node on the wire:

```json
"type": "object",
"nc:container": true,
"properties":{
  "xmlns":{
    "type": "string",
    "format": "urn",
    "nc:attribute": true
  },
  "value":{
    "type":"string"
  }
}
```

Please note that, in order to make this binding work, each href should always contain a leaf that refers to a property of the YANG module.

## TODO

-   [ ] Subscriptions implementation (EVENTS)
-   [x] TEST
-   [ ] (NETCONF Server Protocol Binding ?)

## More Details

See <https://github.com/eclipse/thingweb.node-wot/>

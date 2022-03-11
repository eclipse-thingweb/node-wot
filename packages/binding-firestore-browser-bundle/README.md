# Browser Bundle of Firestore Binding of node-wot

Bundle to run [Firestore Binding](https://github.com/eclipse/thingweb.node-wot/tree/master/packages/binding-firestore) as a browser-side library.

## Supported Protocols

HTTP / HTTPS / WebSockets

## Embedding Firestore Binding library in HTML

Include the following script tag in your html

```js
<script src="https://cdn.jsdelivr.net/npm/@node-wot/binding-firestore-browser-bundle@latest/dist/binding-firestore-bundle.js"></script>
```

You can access all [binding-firestore](https://github.com/eclipse/thingweb.node-wot/tree/master/packages/binding-firestore) functionality through the "BindingFirestore" global object:

```js
var FirestoreClientFactory = BindingFirestore.FirestoreClientFactory;
var FirestoreCodec = BindingFirestore.FirestoreCodec;
var FirestoreServer = BindingFirestore.FirestoreServer;
```

## Using binding-firestore browser bundle library in web frameworks

Install browser-bundle in your project by running

-   `npm install @node-wot/binding-firestore-browser-bundle`

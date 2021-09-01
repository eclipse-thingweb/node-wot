# Browser Bundle of Firestore Binding

Bundle to run Firestore Binding as browser-side library.

## Supported bindings

HTTP / HTTPS / WebSockets

## Embedding Firestore Binding library in HTML

Include the following script tag in your html

```js
<script src="https://cdn.jsdelivr.net/npm/@node-wot/binding-wotfirestore-browser-bundle@latest/dist/binding-wotfirestore-bundle.js"></script>
```

You can access all binding-wotfirestore functionality through the "BindingWoTFirestore" global object:

```js
var WoTFirestoreClientFactory = BindingWoTFirestore.WoTFirestoreClientFactory
var WoTFirestoreCodec = BindingWoTFirestore.WoTFirestoreCodec
var WoTFirestoreServer = BindingWoTFirestore.WoTFirestoreServer
```

## Using binding-wotfirestore browser bundle library in web frameworks

Install browser-bundle in your project by running

- `npm install @node-wot/binding-wotfirestore-browser-bundle`

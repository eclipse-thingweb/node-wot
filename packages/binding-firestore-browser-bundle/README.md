# Browser Bundle of Firestore Binding

Bundle to run Firestore Binding as browser-side library.

## Supported bindings

HTTP / HTTPS / WebSockets

## Embedding Firestore Binding library in HTML

Include the following script tag in your html

```html
<!-- firestore modules -->
<script src="https://www.gstatic.com/firebasejs/9.0.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.0.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.0.1/firebase-firestore-compat.js"></script>
<!-- node-wot modules -->
<script src="https://cdn.jsdelivr.net/npm/@node-wot/browser-bundle/dist/wot-bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@node-wot/binding-firestore-browser-bundle@latest/dist/binding-firestore-bundle.js"></script>
```

You can access all binding-firestore functionality through the "BindingFirestore" global object:

```js
var FirestoreClientFactory = BindingFirestore.FirestoreClientFactory
var FirestoreCodec = BindingFirestore.FirestoreCodec
var FirestoreServer = BindingFirestore.FirestoreServer
```

## Using binding-firestore browser bundle library in web frameworks

Install browser-bundle in your project by running

- `npm install @node-wot/binding-firestore-browser-bundle`

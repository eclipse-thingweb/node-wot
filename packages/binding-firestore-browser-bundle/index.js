"use strict";

const BindingFirestore = require("@node-wot/binding-firestore");

if (typeof window !== "undefined") {
    window.BindingFirestore = BindingFirestore;
} else if (typeof module !== "undefined" && module.exports) {
    module.exports = BindingFirestore;
}
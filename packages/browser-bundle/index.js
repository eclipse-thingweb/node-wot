"use strict";

var Wot = {};
Wot.Tools = require("@node-wot/td-tools");
Wot.Core = require("@node-wot/core");
Wot.Http = require("@node-wot/binding-http");
Wot.WebSocket = require("@node-wot/binding-websockets");

if (typeof window !== "undefined") {
    window.Wot = Wot;
} else if (typeof module !== "undefined" && module.exports) {
    module.exports = Wot;
}

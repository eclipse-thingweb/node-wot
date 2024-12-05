import http from "@node-wot/binding-http";
import core, { Servient } from "@node-wot/core";
import testTM from "./test/resources/test-thing.tm.json" with { type: "json" };

var httpServer = new http.HttpServer({ port: 4433 });
/** @type {Servient} */
var servient = new core.Servient();
servient.addServer(httpServer);

function checkPropertyWrite(expected, actual) {
    const output = "Property " + expected + " written with " + actual;
    if (expected === actual) {
        console.info("PASS: " + output);
    } else {
        throw new Error("FAIL: " + output);
    }
}

function checkActionInvocation(name, expected, actual) {
    const output = "Action " + name + " invoked with " + actual;
    if (expected === actual) {
        console.info("PASS: " + output);
    } else {
        throw new Error("FAIL: " + output);
    }
}

async function exposeTestThing() {
    const WoT = await servient.start();

    // init property values
    let bool = false;
    let int = 42;
    let num = 3.14;
    let string = "unset";
    let array = [2, "unset"];
    let object = { id: 123, name: "abc" };

    const thing = await WoT.produce(testTM);

    console.log("Produced " + thing.getThingDescription().title);
    // set property read/write handlers
    thing
        .setPropertyWriteHandler("bool", async (value) => {
            const localBool = await value.value();
            checkPropertyWrite("boolean", typeof localBool);
            bool = localBool;
            thing.emitEvent("on-bool", bool);
        })
        .setPropertyReadHandler("bool", async () => bool)
        .setPropertyWriteHandler("int", async (value) => {
            const localInt = await value.value();
            if (localInt === Math.floor(localInt)) {
                checkPropertyWrite("integer", "integer");
            } else {
                checkPropertyWrite("integer", typeof value);
            }
            int = localInt;
            thing.emitEvent("on-int", int);
        })
        .setPropertyReadHandler("int", async () => int)
        .setPropertyWriteHandler("num", async (value) => {
            const localNum = await value.value();
            checkPropertyWrite("number", typeof localNum);
            num = localNum;
            thing.emitEvent("on-num", num);
        })
        .setPropertyReadHandler("num", async () => num)
        .setPropertyWriteHandler("string", async (value) => {
            const localString = await value.value();
            checkPropertyWrite("string", typeof localString);
            string = localString;
            thing.emitEvent("on-string", string);
        })
        .setPropertyReadHandler("string", async () => string)
        .setPropertyWriteHandler("array", async (value) => {
            const localArray = await value.value();
            if (Array.isArray(localArray)) {
                checkPropertyWrite("array", "array");
            } else {
                checkPropertyWrite("array", typeof localArray);
            }
            array = localArray;
            thing.emitEvent("on-array", array);
        })
        .setPropertyReadHandler("array", async () => array)
        .setPropertyWriteHandler("object", async (value) => {
            const localObject = await value.value();
            if (Array.isArray(localObject)) {
                checkPropertyWrite("object", "array");
            } else {
                checkPropertyWrite("object", typeof localObject);
            }
            object = localObject;
            thing.emitEvent("on-object", object);
        })
        .setPropertyReadHandler("object", async () => object);
    // set action handlers
    thing
        .setActionHandler("void-void", async (parameters) => {
            checkActionInvocation("void-void", "undefined", typeof (await parameters.value()));
            return undefined;
        })
        .setActionHandler("void-int", async (parameters) => {
            checkActionInvocation("void-int", "undefined", typeof (await parameters.value()));
            return 0;
        })
        .setActionHandler("int-void", async (parameters) => {
            const localParameters = await parameters.value();
            if (localParameters === Math.floor(localParameters)) {
                checkActionInvocation("int-void", "integer", "integer");
            } else {
                checkActionInvocation("int-void", "integer", typeof parameters);
            }
            return undefined;
        })
        .setActionHandler("int-int", async (parameters) => {
            const localParameters = await parameters.value();
            if (localParameters === Math.floor(localParameters)) {
                checkActionInvocation("int-int", "integer", "integer");
            } else {
                checkActionInvocation("int-int", "integer", typeof localParameters);
            }
            return localParameters + 1;
        })
        .setActionHandler("int-string", async (parameters) => {
            const localParameters = await parameters.value();
            const inputtype = typeof localParameters;
            if (localParameters === Math.floor(localParameters)) {
                checkActionInvocation("int-string", "integer", "integer");
            } else {
                checkActionInvocation("int-string", "integer", typeof localParameters);
            }
            if (inputtype === "number") {
                // eslint-disable-next-line no-new-wrappers
                return new String(localParameters)
                    .replace(/0/g, "zero-")
                    .replace(/1/g, "one-")
                    .replace(/2/g, "two-")
                    .replace(/3/g, "three-")
                    .replace(/4/g, "four-")
                    .replace(/5/g, "five-")
                    .replace(/6/g, "six-")
                    .replace(/7/g, "seven-")
                    .replace(/8/g, "eight-")
                    .replace(/9/g, "nine-");
            } else {
                throw new Error("ERROR");
            }
        })
        .setActionHandler("void-obj", async (parameters) => {
            checkActionInvocation("void-complex", "undefined", typeof (await parameters.value()));
            return { prop1: 123, prop2: "abc" };
        })
        .setActionHandler("obj-void", async (parameters) => {
            checkActionInvocation("complex-void", "object", typeof (await parameters.value()));
            return undefined;
        });
    await thing.expose();

    console.info(thing.getThingDescription().title + " ready");
}

async function cleanup() {
    await servient.shutdown();
    console.log("servient cleaned up");
}

function controlTestServient() {
    return {
        name: "wot-servient",

        async executeCommand({ command }) {
            switch (command) {
                case "wot-start":
                    try {
                        exposeTestThing();
                    } catch (error) {
                        console.log(error);
                    }
                    return true;
                case "wot-stop":
                    await cleanup();
                    return true;
                default:
                    break;
            }
        },
    };
}

// your web-test-runner.config.js
export default {
    plugins: [controlTestServient()],
};

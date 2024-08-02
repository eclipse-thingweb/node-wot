import { expect, use } from "@esm-bundle/chai";
import chaiAsPromised from "@esm-bundle/chai-as-promised";
import { executeServerCommand } from "@web/test-runner-commands";
import testTM from "./resources/test-thing.tm.json" with { type: "json" };
import { JSONSchemaFaker } from "json-schema-faker";
import { Core, Http } from "../";

use(chaiAsPromised);

describe("Node-wot integration tests for browser", () => {
    /** @type {import("wot-typescript-definitions")} */
    let WoT;
    /** @type {import("@node-wot/core").Servient} */
    let servient;
    before(async () => {
        expect(Core).to.not.be.undefined;
        expect(Http).to.not.be.undefined;
        servient = new Core.Servient();
        servient.addClientFactory(new Http.HttpClientFactory());
        WoT = await servient.start();
        await executeServerCommand("wot-start");
    });

    it("should request Thing Description", async () => {
        const td = await WoT.requestThingDescription("http://localhost:4433/testthing");
        expect(td).to.not.be.undefined;
        expect(td.title).to.be.equal("TestThing");
    });

    it("should consume thing description", async () => {});

    describe("Interaction with remote thing", () => {
        /** @type {import("wot-typescript-definitions").ConsumedThing} */
        let thing;
        before(async () => {
            const td = await WoT.requestThingDescription("http://localhost:4433/testthing");
            thing = await WoT.consume(td);
        });

        for (const property of Object.keys(testTM.properties)) {
            it(`read property ${property} `, async () => {
                const res = await thing.readProperty(property);
                const value = await res.value();
                expect(value).to.not.be.undefined;
            });

            it(`write property ${property} `, async () => {
                const value = JSONSchemaFaker.generate(testTM.properties[property]);
                await expect(thing.writeProperty(property, value)).to.eventually.be.fulfilled;
            });
        }

        for (const action of Object.keys(testTM.actions)) {
            it(`invoke action ${action} `, async () => {
                let input = undefined;
                if (testTM.actions[action].input) {
                    input = JSONSchemaFaker.generate(testTM.actions[action].input);
                }
                const result = await thing.invokeAction(action, input);
                if (testTM.actions[action].output) {
                    const value = await result.value();
                    expect(value).to.not.be.undefined;
                }
            });
        }

        for (const event of Object.keys(testTM.events)) {
            it(`subscribe ${event} `, async () => {
                const property = event.replace("on-", "");
                let resolve;
                const promise = new Promise((r) => {
                    resolve = r;
                });

                const sub = await thing.subscribeEvent(event, async (data) => {
                    await sub.stop();
                    resolve();
                });
                const value = JSONSchemaFaker.generate(testTM.properties[property]);
                await expect(thing.writeProperty(property, value)).to.eventually.be.fulfilled;
                await expect(promise).to.eventually.be.fulfilled;
            });
        }
    });

    after(async () => {
        servient.shutdown();
        await executeServerCommand("wot-stop");
    });
});

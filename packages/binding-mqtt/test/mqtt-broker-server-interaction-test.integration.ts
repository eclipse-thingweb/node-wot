/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

import Servient, { createInfoLogger } from "@node-wot/core";
import { expect, should } from "chai";
import MqttBrokerServer from "../src/mqtt-broker-server";
import MqttClientFactory from "../src/mqtt-client-factory";
import { ConsumedThing } from "wot-typescript-definitions";

const info = createInfoLogger("binding-mqtt", "mqtt-broker-server-interaction-test.integration");

// should must be called to augment all variables
should();

describe("MQTT broker server interaction implementation", () => {
    let servient: Servient;
    let brokerServer: MqttBrokerServer;

    const brokerAddress = "localhost";
    const brokerPort = 1889;
    const brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;

    const mqttThingModel: WoT.ExposedThingInit = {
        title: "mqtt-thing-model",
        description: "MQTT Thing Model for testing",
        properties: {
            stringProperty: {
                type: "string",
                observable: true,
                readOnly: false,
                writeOnly: true,
            },
            numberProperty: {
                type: "number",
                observable: true,
                readOnly: false,
                writeOnly: true,
            },
            arrayProperty: {
                type: "array",
                observable: true,
                readOnly: false,
                writeOnly: true,
            },
            objectProperty: {
                type: "object",
                observable: true,
                readOnly: false,
                writeOnly: true,
            },
        },
        actions: {
            stringAction: {
                input: {
                    type: "string",
                },
            },
            numberAction: {
                input: {
                    type: "number",
                },
            },
            arrayAction: {
                input: {
                    type: "array",
                },
            },
            objectAction: {
                input: {
                    type: "object",
                },
            },
        },
    };

    let mqttClient: ConsumedThing;

    let stringProperty: string;
    let numberProperty: number;
    let arrayProperty: [];
    let objectProperty: Record<string, unknown>;

    let stringAction: string;
    let numberAction: number;
    let arrayAction: [];
    let objectAction: Record<string, unknown>;

    before((done: Mocha.Done) => {
        servient = new Servient();
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);
        servient.addClientFactory(new MqttClientFactory());
        servient.start().then((WoT) => {
            WoT.produce(mqttThingModel)
                .then((thing) => {
                    thing.setPropertyWriteHandler("stringProperty", async (inputData) => {
                        stringProperty = (await inputData.value()) as string;
                    });

                    thing.setPropertyWriteHandler("numberProperty", async (inputData) => {
                        numberProperty = (await inputData.value()) as number;
                    });

                    thing.setPropertyWriteHandler("arrayProperty", async (inputData) => {
                        arrayProperty = (await inputData.value()) as [];
                    });

                    thing.setPropertyWriteHandler("objectProperty", async (inputData) => {
                        objectProperty = (await inputData.value()) as Record<string, unknown>;
                    });

                    thing.setActionHandler("stringAction", async (inputData) => {
                        stringAction = (await inputData.value()) as string;

                        return stringAction;
                    });

                    thing.setActionHandler("numberAction", async (inputData) => {
                        numberAction = (await inputData.value()) as number;

                        return numberAction;
                    });

                    thing.setActionHandler("arrayAction", async (inputData) => {
                        arrayAction = (await inputData.value()) as [];

                        return arrayAction;
                    });

                    thing.setActionHandler("objectAction", async (inputData) => {
                        objectAction = (await inputData.value()) as Record<string, unknown>;

                        return objectAction;
                    });

                    thing.expose().then(() => {
                        info(`Exposed ${thing.getThingDescription().title}`);

                        WoT.consume(thing.getThingDescription()).then((client) => {
                            mqttClient = client;
                        });
                    });
                })
                .then(() => {
                    done();
                });
        });
    });

    after(async () => {
        await servient.shutdown();
        await brokerServer.stop();
    });

    it("should write property (string)", (done: Mocha.Done) => {
        const input = "writeProperty";

        mqttClient
            .writeProperty("stringProperty", input)
            .then(() => {
                setTimeout(() => {
                    expect(stringProperty).to.equal(input);
                    done();
                }, 100);
            })
            .catch((e) => {
                done(e);
            });
    }).timeout(20000);

    it("should write property (number)", (done: Mocha.Done) => {
        const input = 1337;

        mqttClient
            .writeProperty("numberProperty", input)
            .then(() => {
                setTimeout(() => {
                    expect(numberProperty).to.equal(input);
                    done();
                }, 100);
            })
            .catch((e) => {
                done(e);
            });
    }).timeout(20000);

    it("should write property (array)", (done: Mocha.Done) => {
        const input = [1, 3, 3, 7];

        mqttClient
            .writeProperty("arrayProperty", input)
            .then(() => {
                setTimeout(() => {
                    expect(arrayProperty).to.eql(input);
                    done();
                }, 100);
            })
            .catch((e) => {
                done(e);
            });
    }).timeout(20000);

    it("should write property (object)", (done: Mocha.Done) => {
        const input = {
            test_number: 23,
            test_string: "test",
            test_array: ["t", "e", "s", "t"],
        };

        mqttClient
            .writeProperty("objectProperty", input)
            .then(() => {
                setTimeout(() => {
                    expect(objectProperty).to.eql(input);
                    done();
                }, 100);
            })
            .catch((e) => {
                done(e);
            });
    }).timeout(20000);

    it("should invoke action (string)", (done: Mocha.Done) => {
        const input = "invokeAction";

        mqttClient
            .invokeAction("stringAction", input)
            .then((res) => {
                setTimeout(() => {
                    expect(stringAction).to.equal(input);
                    done();
                }, 100);
            })
            .catch((e) => {
                done(e);
            });
    }).timeout(20000);

    it("should invoke action (number)", (done: Mocha.Done) => {
        const input = 1337;

        mqttClient
            .invokeAction("numberAction", input)
            .then((res) => {
                setTimeout(() => {
                    expect(numberAction).to.equal(input);
                    done();
                }, 100);
            })
            .catch((e) => {
                done(e);
            });
    }).timeout(20000);

    it("should invoke action (array)", (done: Mocha.Done) => {
        const input = [1, 3, 3, 7];

        mqttClient
            .invokeAction("arrayAction", input)
            .then((res) => {
                setTimeout(() => {
                    expect(arrayAction).to.eql(input);
                    done();
                }, 100);
            })
            .catch((e) => {
                done(e);
            });
    }).timeout(20000);

    it("should invoke action (object)", (done: Mocha.Done) => {
        const input = {
            test_number: 23,
            test_string: "test",
            test_array: ["t", "e", "s", "t"],
        };

        mqttClient
            .invokeAction("objectAction", input)
            .then((res) => {
                setTimeout(() => {
                    expect(objectAction).to.eql(input);
                    done();
                }, 100);
            })
            .catch((e) => {
                done(e);
            });
    }).timeout(20000);
});

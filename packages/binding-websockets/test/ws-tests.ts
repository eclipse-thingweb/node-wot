/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

/**
 * Protocol test suite to test protocol implementations
 */

import Servient, { createLoggers } from "@node-wot/core";
import { suite, test } from "@testdeck/mocha";
import { expect, should } from "chai";
import WebSocketServer from "../src/ws-server";
import WebSocketClient from "../src/ws-client";
import * as WebSocket from "ws";

const { info } = createLoggers("binding-websockets", "ws-tests");

// should must be called to augment all variables
should();

const port = 31080;
@suite("WebSockets binding")
class WebSocketsTest {
    @test async "should start and stop own server"() {
        const wsServer = new WebSocketServer({ port });

        await wsServer.start(new Servient());
        expect(wsServer.getPort()).to.eq(port); // from test

        info("Test stopping WebSocket server");

        await wsServer.stop();
        expect(wsServer.getPort()).to.eq(-1); // from getPort() when not listening
    }

    @test async "should handle multiple endpoints on same host"() {
        // Regression test for connection key issue
        // Previously, connections were keyed by ws://host:port, preventing multiple endpoints
        // Now they should be keyed by full href (ws://host:port/path)

        const testPort = 31081;
        const mockServer = new WebSocket.Server({ port: testPort });
        const receivedConnections: string[] = [];

        mockServer.on("connection", (ws, req) => {
            receivedConnections.push(req.url ?? "/");
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                // Echo back with id
                ws.send(JSON.stringify({ id: data.id, path: req.url, value: "test" }));
            });
        });

        const client = new WebSocketClient();
        await client.start();

        try {
            // Create forms for two different endpoints on same host
            const form1 = {
                href: `ws://localhost:${testPort}/endpoint1`,
                contentType: "application/json",
            };
            const form2 = {
                href: `ws://localhost:${testPort}/endpoint2`,
                contentType: "application/json",
            };

            // Both should succeed and connect to different paths
            await client.readResource(form1);
            await client.readResource(form2);

            expect(receivedConnections).to.include("/endpoint1");
            expect(receivedConnections).to.include("/endpoint2");
        } finally {
            await client.stop();
            mockServer.close();
        }
    }

    @test async "should align subscription bookkeeping between subscribe and message handling"() {
        // Regression test for subscription key mismatch
        // Previously, subscribeResource used "baseUrl:resourceName" but handleGenericMessage used just "baseUrl"
        // This caused subscription updates to fail

        const testPort = 31082;
        const mockServer = new WebSocket.Server({ port: testPort });

        mockServer.on("connection", (ws) => {
            // Simulate subscription update after a delay
            setTimeout(() => {
                ws.send(JSON.stringify({ resource: "temperature", value: 42 }));
            }, 100);
        });

        const client = new WebSocketClient();
        await client.start();

        try {
            const form = {
                href: `ws://localhost:${testPort}/properties/temperature`,
                contentType: "application/json",
            };

            let updateReceived = false;
            const subscription = await client.subscribeResource(
                form,
                (content) => {
                    updateReceived = true;
                },
                undefined,
                undefined
            );

            // Wait for subscription update
            await new Promise((resolve) => setTimeout(resolve, 200));

            expect(updateReceived).to.be.true;

            subscription.unsubscribe();
        } finally {
            await client.stop();
            mockServer.close();
        }
    }

    @test async "should use correct WoT unsubscribe verbs"() {
        // Regression test for non-spec "operation: unsubscribe"
        // Previously used generic "unsubscribe", now should use "unsubscribeproperty" or "unsubscribeevent"

        const testPort = 31083;
        const mockServer = new WebSocket.Server({ port: testPort });
        let unsubscribeOperation: string | undefined;

        mockServer.on("connection", (ws) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());

                // Capture unsubscribe operation
                if (data.operation?.startsWith("unsubscribe")) {
                    unsubscribeOperation = data.operation;
                }

                // Send appropriate response
                if (data.operation === "subscribeproperty") {
                    ws.send(
                        JSON.stringify({
                            messageType: "response",
                            correlationID: data.messageID,
                        })
                    );
                } else if (data.operation === "unsubscribeproperty") {
                    ws.send(
                        JSON.stringify({
                            messageType: "response",
                            correlationID: data.messageID,
                        })
                    );
                }
            });
        });

        const client = new WebSocketClient();
        await client.start();

        try {
            const form = {
                href: `ws://localhost:${testPort}/things/test/properties/temp`,
                contentType: "application/json",
                "wot:protocol": "webthing",
                op: "subscribeproperty",
            };

            await client.subscribeResource(form, () => {}, undefined, undefined);

            // Unsubscribe should trigger the correct operation
            await client.unlinkResource(form);

            // Give time for message to be sent
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(unsubscribeOperation).to.equal("unsubscribeproperty");
        } finally {
            await client.stop();
            mockServer.close();
        }
    }

    @test async "should use unsubscribeevent for event subscriptions"() {
        // Verify that event subscriptions use the correct unsubscribe verb

        const testPort = 31084;
        const mockServer = new WebSocket.Server({ port: testPort });
        let unsubscribeOperation: string | undefined;

        mockServer.on("connection", (ws) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());

                // Capture unsubscribe operation
                if (data.operation?.startsWith("unsubscribe")) {
                    unsubscribeOperation = data.operation;
                }

                // Send appropriate response
                if (data.operation === "subscribeevent") {
                    ws.send(
                        JSON.stringify({
                            messageType: "response",
                            correlationID: data.messageID,
                        })
                    );
                } else if (data.operation === "unsubscribeevent") {
                    ws.send(
                        JSON.stringify({
                            messageType: "response",
                            correlationID: data.messageID,
                        })
                    );
                }
            });
        });

        const client = new WebSocketClient();
        await client.start();

        try {
            const form = {
                href: `ws://localhost:${testPort}/things/test/events/changed`,
                contentType: "application/json",
                "wot:protocol": "webthing",
                op: "subscribeevent",
            };

            await client.subscribeResource(form, () => {}, undefined, undefined);

            // Unsubscribe should trigger the correct operation
            await client.unlinkResource(form);

            // Give time for message to be sent
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(unsubscribeOperation).to.equal("unsubscribeevent");
        } finally {
            await client.stop();
            mockServer.close();
        }
    }
}

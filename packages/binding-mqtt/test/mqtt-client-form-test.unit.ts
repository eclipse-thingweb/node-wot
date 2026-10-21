/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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

import { expect } from "chai";
import sinon from "sinon";
import { MqttClient } from "../src/mqtt";
import MQTTMessagePool from "../src/mqtt-message-pool";
import { Readable } from "stream";
import { Content } from "@node-wot/core";

describe("MQTT client form parsing - unit", () => {
    let subscribe: sinon.SinonStub;
    let publish: sinon.SinonStub;

    beforeEach(() => {
        sinon.stub(MQTTMessagePool.prototype, "connect").resolves();
        subscribe = sinon.stub(MQTTMessagePool.prototype, "subscribe").resolves();
        publish = sinon.stub(MQTTMessagePool.prototype, "publish").resolves();
        sinon.stub(MQTTMessagePool.prototype, "unsubscribe").resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should fall back to mqv:filter when href has no path in subscribe", async () => {
        await new MqttClient().subscribeResource({ href: "mqtt://localhost:1883", "mqv:filter": "foo/bar" }, () => {});

        expect(subscribe.firstCall.args[0]).to.equal("foo/bar");
    });

    it("should fall back to mqv:filter when href has no path in read property", async () => {
        // readResource resolves only once a message arrives on the subscription
        subscribe.callsFake(async (filter: string, onMessage: (topic: string, message: Buffer) => void) =>
            onMessage(filter, Buffer.from("42"))
        );

        await new MqttClient().readResource({ href: "mqtt://localhost:1883", "mqv:filter": "foo/bar" });

        expect(subscribe.firstCall.args[0]).to.equal("foo/bar");
    });

    it("should fall back to mqv:topic when href has no path in write property", async () => {
        const stream = Readable.from(Buffer.from("23"));
        await new MqttClient().writeResource(
            { href: "mqtt://localhost:1883", "mqv:topic": "foo/bar" },
            new Content("application/json", stream)
        );

        expect(publish.firstCall.args[0]).to.equal("foo/bar");
    });

    it("should fall back to mqv:topic when href has no path in invoke action", async () => {
        const stream = Readable.from(Buffer.from("23"));
        await new MqttClient().invokeResource(
            { href: "mqtt://localhost:1883", "mqv:topic": "foo/bar" },
            new Content("application/json", stream)
        );

        expect(publish.firstCall.args[0]).to.equal("foo/bar");
    });
});

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

/**
 * Edge case tests for subprotocol and composite scheme support
 */

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import { Readable } from "stream";
import Servient from "../src/servient";
import { ProtocolClient, ProtocolClientFactory } from "../src/protocol-interfaces";
import Helpers from "../src/helpers";
import { Content } from "../src/content";
import { Form } from "../src/thing-description";
import { Subscription } from "rxjs/Subscription";

class MockClient implements ProtocolClient {
    async readResource(_form: Form): Promise<Content> {
        return new Content("application/json", Readable.from(Buffer.from("{}")));
    }
    async writeResource(_form: Form, _content: Content): Promise<void> {}
    async invokeResource(_form: Form, _content?: Content): Promise<Content> {
        return new Content("application/json", Readable.from(Buffer.from("{}")));
    }
    async unlinkResource(_form: Form): Promise<void> {}
    async subscribeResource(
        _form: Form,
        _next: (content: Content) => void,
        _error?: (error: Error) => void,
        _complete?: () => void
    ): Promise<Subscription> {
        return new Subscription();
    }
    async requestThingDescription(_uri: string): Promise<Content> {
        return new Content("application/json", Readable.from(Buffer.from("{}")));
    }
    async start() {}
    async stop() {}
    setSecurity() {
        return true;
    }
}

class MockMqttFactory implements ProtocolClientFactory {
    readonly scheme = "mqtt";
    getSchemes() {
        return ["mqtt", "mqtts", "mqtt+ws", "mqtt+wss"];
    }
    supportsSubprotocol(scheme: string, subprotocol: string) {
        return (scheme === "ws" || scheme === "wss") && subprotocol === "mqtt";
    }
    getClient() {
        return new MockClient();
    }
    init() {
        return true;
    }
    destroy() {
        return true;
    }
}

class EmptySchemeFactory implements ProtocolClientFactory {
    readonly scheme = "test";
    getSchemes() {
        return [];
    }
    getClient() {
        return new MockClient();
    }
    init() {
        return true;
    }
    destroy() {
        return true;
    }
}

@suite("Subprotocol edge cases")
class SubprotocolEdgeCasesTest {
    @test "should handle empty string subprotocol"() {
        const servient = new Servient();
        servient.addClientFactory(new MockMqttFactory());

        // empty string should not trigger subprotocol matching
        const client = servient.getClientFor("mqtt", "");
        expect(client).to.exist;
    }

    @test "should handle whitespace-only subprotocol"() {
        const servient = new Servient();
        servient.addClientFactory(new MockMqttFactory());

        // whitespace should not match
        const client = servient.getClientFor("mqtt", "   ");
        expect(client).to.exist;
    }

    @test "should handle case-insensitive subprotocol matching"() {
        const servient = new Servient();
        servient.addClientFactory(new MockMqttFactory());

        // MQTT (uppercase) should match mqtt (lowercase)
        const client = servient.getClientFor("ws", "MQTT");
        expect(client).to.exist;
    }

    @test "should handle case-insensitive scheme matching"() {
        const servient = new Servient();
        servient.addClientFactory(new MockMqttFactory());

        // WS (uppercase) should match ws (lowercase)
        const client = servient.getClientFor("WS", "mqtt");
        expect(client).to.exist;
    }

    @test "should handle getSchemes returning empty array"() {
        const servient = new Servient();
        servient.addClientFactory(new EmptySchemeFactory());

        expect(() => servient.getClientFor("mqtt+ws")).to.throw();
    }

    @test "should handle factory without getSchemes method"() {
        const servient = new Servient();
        const basicFactory: ProtocolClientFactory = {
            scheme: "basic",
            getClient: () => new MockClient(),
            init: () => true,
            destroy: () => true,
        };
        servient.addClientFactory(basicFactory);

        // should still work with just primary scheme
        const client = servient.getClientFor("basic");
        expect(client).to.exist;
    }

    @test "should handle factory without supportsSubprotocol method"() {
        const servient = new Servient();
        const basicFactory: ProtocolClientFactory = {
            scheme: "basic",
            getClient: () => new MockClient(),
            init: () => true,
            destroy: () => true,
        };
        servient.addClientFactory(basicFactory);

        // should fall back to scheme-only matching
        const client = servient.getClientFor("basic", "someprotocol");
        expect(client).to.exist;
    }
}

@suite("Composite scheme edge cases")
class CompositeSchemeEdgeCasesTest {
    @test "should reject malformed composite scheme with trailing plus"() {
        expect(() => Helpers.extractScheme("mqtt+://broker")).to.throw();
    }

    @test "should reject malformed composite scheme with leading plus"() {
        expect(() => Helpers.extractScheme("+ws://broker")).to.throw();
    }

    @test "should reject composite scheme with only plus"() {
        expect(() => Helpers.extractScheme("+://broker")).to.throw();
    }

    @test "should handle composite scheme case insensitivity"() {
        const scheme = Helpers.extractScheme("MQTT+WS://broker");
        expect(scheme).to.equal("mqtt+ws");
    }

    @test "should handle composite scheme with numbers"() {
        const scheme = Helpers.extractScheme("protocol1+transport2://broker");
        expect(scheme).to.equal("protocol1+transport2");
    }

    @test "should reject empty URI"() {
        expect(() => Helpers.extractScheme("")).to.throw();
    }

    @test "should reject URI without scheme"() {
        expect(() => Helpers.extractScheme("//broker")).to.throw();
    }

    @test "should reject URI with only scheme separator"() {
        expect(() => Helpers.extractScheme("://broker")).to.throw();
    }
}

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

import { suite, test, timeout } from "@testdeck/mocha";
import { expect } from "chai";

import CoapServer from "../src/coap-server";
import CoapClient from "../src/coap-client";
import { CoapForm } from "../src/coap";

const port1 = 31833;
const port2 = 31834;

/**
 * Helper function for waiting during tests.
 *
 * @param ms The time to wait in miliseconds.
 * @returns A Promise that is resolved after the given time period.
 */
function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

@suite("CoAP client implementation")
class CoapClientTest {
    @test async "should apply form information"() {
        // const testThing = Helpers.extend(
        //     {
        //         name: "Test",
        //         properties: {
        //             test: {},
        //         },
        //     },
        //     new ExposedThing(null)
        // );
        // testThing.extendInteractions();
        // await testThing.writeProperty("test", "UNSET");

        const coapServer = new CoapServer(port1);

        await coapServer.start(null);
        expect(coapServer.getPort()).to.equal(port1);

        /*
        coapServer.expose(testThing);

        let client = new CoapClient();

        // read with POST instead of GET
        await client.readResource({
            href: "coap://localhost:56833/",
            "coap:methodCode": 2 // POST
        });
        expect(testThing.expect).to.equal("POST");
        testVector.expect = "UNSET";

        // write with POST instead of PUT
        representation = await client.writeResource({
            href: "coap://localhost:56833/",
            "coap:methodCode": 2 // POST
        }, { contentType: ContentSerdes.DEFAULT, body: Buffer.from("test") });
        expect(testVector.expect).to.equal("POST");
        testVector.expect = "UNSET";

        // invoke with PUT instead of POST
        representation = await client.invokeResource({
            href: "coap://localhost:56833/",
            "coap:methodCode": 3 // PUT
        }, { contentType: ContentSerdes.DEFAULT, body: Buffer.from("test") });
        expect(testVector.expect).to.equal("PUT");
        testVector.expect = "UNSET";

        // invoke with DELETE instead of POST
        representation = await client.invokeResource({
            href: "coap://localhost:56833/",
            "coap:methodCode": 4 // DELETE
        }, { contentType: ContentSerdes.DEFAULT, body: Buffer.from("test") });
        expect(testVector.expect).to.equal("DELETE");
        testVector.expect = "UNSET";
        */

        await coapServer.stop();
    }

    @test async "should re-use port"() {
        const coapServer = new CoapServer(port2, "localhost");
        await coapServer.start(null);
        const coapClient = new CoapClient(coapServer);
        await coapClient.readResource({
            href: `coap://localhost:${port2}/`,
        });
        await sleep(50); // Wait for client to send its ACK
        await coapServer.stop();
    }

    @test(timeout(5000)) async "subscribe test"() {
        const coapServer = new CoapServer(port2, "localhost");
        await coapServer.start(null);
        const coapClient = new CoapClient(coapServer);
        const form: CoapForm = {
            href: `coap://127.0.0.1:${port2}`,
            "cov:methodName": "GET",
        };
        const subscription = await coapClient.subscribeResource(form, (value) => {
            /**  */
        });
        subscription.unsubscribe();
        await coapServer.stop();
    }
}

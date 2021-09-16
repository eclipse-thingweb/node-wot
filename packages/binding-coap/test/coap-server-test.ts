/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

import { suite, test } from "@testdeck/mocha";
import { expect, should, assert } from "chai";

import CoapServer from "../src/coap-server";
// should must be called to augment all variables
should();

const coap = require("coap");

@suite("CoAP server implementation")
class CoapServerTest {
    @test async "should start and stop a server"() {
        const coapServer = new CoapServer(56831);

        await coapServer.start(null);
        expect(coapServer.getPort()).to.eq(56831); // from test

        await coapServer.stop();
        expect(coapServer.getPort()).to.eq(-1); // from getPort() when not listening
    }

    @test.skip async "should cause EADDRINUSE error when already running"() {
        const coapServer1 = new CoapServer(0); // cannot use 0, since getPort() does not work
        await coapServer1.start(null);

        expect(coapServer1.getPort()).to.be.above(0); // from server._port, not real socket

        const coapServer2 = new CoapServer(coapServer1.getPort());

        try {
            await coapServer2.start(null); // should fail, but does not...
        } catch (err) {
            assert(true);
        }

        expect(coapServer2.getPort()).to.eq(-1);

        // TODO expose Thing on coapServer1
        const req = coap.request({ method: "GET", hostname: "localhost", port: coapServer1.getPort(), path: "/" });
        req.on("response", async (res: any) => {
            expect(res.payload.toString()).to.equal("One");

            await coapServer1.stop();
            await coapServer2.stop();
        });
        req.end();
    }
}

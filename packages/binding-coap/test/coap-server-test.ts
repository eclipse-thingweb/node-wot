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
import { expect, should } from "chai";

import CoapServer from "../src/coap-server";
// should must be called to augment all variables
should();

@suite("CoAP server implementation")
class CoapServerTest {
    @test async "should start and stop a server"() {
        const coapServer = new CoapServer(56831);

        await coapServer.start(null);
        expect(coapServer.getPort()).to.eq(56831); // from test

        await coapServer.stop();
        expect(coapServer.getPort()).to.eq(-1); // from getPort() when not listening
    }

    // This test has been commented out until further information from node-coap
    // repo maintainer about having two coap server instances listening to the same port
    // Issue: https://github.com/mcollina/node-coap/issues/268
    //
    // @test async "should cause EADDRINUSE error when already running"() {
    //     const coapServer1 = new CoapServer(56832);
    //     await coapServer1.start(null);

    //     expect(coapServer1.getPort()).to.eq(56832);

    //     const coapServer2 = new CoapServer(coapServer1.getPort());

    //     try {
    //         await coapServer2.start(null);
    //     } catch(err) {
    //         assert(true);
    //     }

    //     expect(coapServer2.getPort()).to.eq(56832);

    //     await coapServer1.stop();
    //     await coapServer2.stop();
    // }
}

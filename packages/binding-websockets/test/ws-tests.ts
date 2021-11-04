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
import WebSocketServer from "../src/ws-server";

// should must be called to augment all variables
should();

const port = 31080;
@suite("WebSockets binding")
class WebSocketsTest {
    @test async "should start and stop own server"() {
        const wsServer = new WebSocketServer({ port });

        await wsServer.start(null);
        expect(wsServer.getPort()).to.eq(port); // from test

        console.log("Test stopping WebSocket server");

        await wsServer.stop();
        expect(wsServer.getPort()).to.eq(-1); // from getPort() when not listening
    }
}

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

import { suite, test } from "@testdeck/mocha";
import chai, { expect, should } from "chai";
import spies from "chai-spies";

import HttpClientFactory from "../src/http-client-factory";
import HttpsClientFactory from "../src/https-client-factory";
import HttpClient from "../src/http-client";

should();
chai.use(spies);

@suite("HTTP client lifecycle")
class HttpClientLifecycleTest {
    @test "HTTP factory destruction stops every created client"() {
        const factory = new HttpClientFactory();
        const firstClient = factory.getClient();
        const secondClient = factory.getClient();
        const firstStop = chai.spy.on(firstClient, "stop");
        const secondStop = chai.spy.on(secondClient, "stop");

        expect(factory.destroy()).to.equal(true);

        firstStop.should.have.been.called.once;
        secondStop.should.have.been.called.once;
    }

    @test "HTTPS factory destruction stops every created client"() {
        const factory = new HttpsClientFactory();
        const firstClient = factory.getClient();
        const secondClient = factory.getClient();
        const firstStop = chai.spy.on(firstClient, "stop");
        const secondStop = chai.spy.on(secondClient, "stop");

        expect(factory.destroy()).to.equal(true);

        firstStop.should.have.been.called.once;
        secondStop.should.have.been.called.once;
    }

    @test async "client stop closes and clears active subscriptions"() {
        const client = new HttpClient();
        const close = chai.spy();
        client["activeSubscriptions"].set("http://example.test/observation", {
            open: async () => undefined,
            close,
        });

        await client.stop();

        close.should.have.been.called.once;
        expect(client["activeSubscriptions"].size).to.equal(0);
    }

    @test async "unlink closes and forgets the active subscription"() {
        const client = new HttpClient();
        const close = chai.spy();
        const href = "http://example.test/observation";
        client["activeSubscriptions"].set(href, {
            open: async () => undefined,
            close,
        });

        await client.unlinkResource({ href });

        close.should.have.been.called.once;
        expect(client["activeSubscriptions"].has(href)).to.equal(false);
    }
}

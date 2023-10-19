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
import { expect, should } from "chai";
import * as chai from "chai";
import MBusClient from "../src/mbus-client";
import { MBusForm } from "../src/mbus";
import chaiAsPromised from "chai-as-promised";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);

describe("mbus client test", () => {
    let client: MBusClient;

    before(() => {
        // Turn off logging to have a clean test log
        console.debug = () => {
            /* nothing */
        };
        console.warn = () => {
            /* nothing */
        };
    });

    beforeEach(() => {
        client = new MBusClient();
    });
    afterEach(() => {
        client.stop();
    });
    after(() => {
        /* nothing */
    });

    it("should override form values with URL", () => {
        const form: MBusForm = {
            href: "mbus+tcp://127.0.0.1:805/2?offset=2&timeout=5",
            "mbus:offset": 0,
            "mbus:timeout": 1,
            "mbus:unitID": 1,
        };

        // eslint-disable-next-line dot-notation
        client["overrideFormFromURLPath"](form);
        form["mbus:unitID"].should.be.equal(2, "Form value not overridden");
        if (form["mbus:offset"]) {
            form["mbus:offset"].should.be.equal(2, "Form value not overridden");
        } else {
            expect.fail("mbus:offset undefined");
        }
        if (form["mbus:timeout"]) {
            form["mbus:timeout"].should.be.equal(5, "Form value not overridden");
        } else {
            expect.fail("mbus:timeout undefined");
        }
    });

    describe("read resource", () => {
        it("should throw exception for missing offset", () => {
            const form: MBusForm = {
                href: "mbus+tcp://127.0.0.1:805",
                "mbus:unitID": 1,
            };

            const promise = client.readResource(form);

            return promise.should.eventually.rejectedWith("Malformed form: offset must be defined");
        });
    });
});

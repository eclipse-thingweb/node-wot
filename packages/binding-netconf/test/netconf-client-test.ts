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

import chai, { expect, should } from "chai";

import { DefaultContent } from "@node-wot/core";

import NetconfClient from "../src/netconf-client";
import * as xpath2json from "../src/xpath2json";
import { Readable } from "stream";
import spies from "chai-spies";

// should must be called to augment all variables
should();

chai.use(spies);

describe("outer describe", function () {
    this.timeout(10000);
    let client: NetconfClient;

    before(() => {
        client = new NetconfClient();
    });

    it("should apply security", async function () {
        const metadata = [{ scheme: "nosec" }];
        const credentials = {
            username: "user",
            password: "test",
        };
        client.setSecurity(metadata, credentials);
    });

    it("should fail to read a property because of no connection to server", async function () {
        const inputVector = {
            form: {
                href: "netconf://localhost:6060/ietf-ip:ipv6/address",
                contentType: "application/netconf",
                op: ["readproperty"],
                "nc:target": "running",
                "nc:NSs": {
                    "ietf-ip": "urn:ietf:params:xml:ns:yang:ietf-ip",
                },
            },
            "nc:method": "GET-CONFIG",
        };
        try {
            await client.readResource(inputVector.form);
        } catch (err) {
            // Note: depending on Node.js version different errors appear
            // AssertionError: expected 'connect ECONNREFUSED ::1:6060' to equal 'connect ECONNREFUSED 127.0.0.1:6060'
            expect((err as Error).message.startsWith("connect ECONNREFUSED"));
        }
    });

    it("should fail to write a property because of no connection to server", async function () {
        const inputVector = {
            form: {
                href: "netconf://localhost:6060/ietf-interfaces:interfaces/interface[name=interface100]",
                contentType: "application/netconf",
                op: ["writeproperty"],
                "nc:target": "candidate",
                "nc:NSs": {
                    "ietf-interfaces": "urn:ietf:params:xml:ns:yang:ietf-interfaces",
                },
            },
            "nc:method": "EDIT-CONFIG",
        };

        const payload = { type: { xmlns: "urn:ietf:params:xml:ns:yang:iana-if-type", value: "modem" } };

        /* let schema = {
            "properties": {
                "type": {
                    "nc:container": true,
                    "type": "object",
                    "properties": {
                        "xmlns": {
                            "type": "string",
                            "nc:attribute": true,
                            "format": "urn"
                        },
                        "value": {
                            "type": "string"
                        }
                    }
                }
            }
        } */

        try {
            await client.writeResource(
                inputVector.form,
                new DefaultContent(Readable.from(Buffer.from(JSON.stringify(payload))))
            );
        } catch (err) {
            // Note: depending on Node.js version different errors appear
            // AssertionError: expected 'connect ECONNREFUSED ::1:6060' to equal 'connect ECONNREFUSED 127.0.0.1:6060'
            expect((err as Error).message.startsWith("connect ECONNREFUSED"));
        }
    });

    it("should fail to invoke an action because of no connection to server", async function () {
        const inputVector = {
            form: {
                href: "netconf://localhost:6060/",
                method: "COMMIT",
                contentType: "application/netconf",
                op: ["invokeaction"],
                "nc:target": "candidate",
                "nc:NSs": {
                    "ietf-interfaces": "urn:ietf:params:xml:ns:yang:ietf-interfaces",
                },
            },
            "nc:method": "RPC",
        };
        const payload = "commit";

        try {
            await client.invokeResource(
                inputVector.form,
                new DefaultContent(Readable.from(Buffer.from(JSON.stringify(payload))))
            );
        } catch (err) {
            // Note: depending on Node.js version different errors appear
            // AssertionError: expected 'connect ECONNREFUSED ::1:6060' to equal 'connect ECONNREFUSED 127.0.0.1:6060'
            expect((err as Error).message.startsWith("connect ECONNREFUSED"));
        }
    });

    it("should properly add leaves to XPATH", async function () {
        let xpathQuery = "/ietf-interfaces:interfaces/interface/interface"; // the binding automatically adds again the leaf. addLeaves then removes it
        const payload = { name: "interface100" };
        const validXpathQuery = '/ietf-interfaces:interfaces/interface[name="interface100"]';
        xpathQuery = xpath2json.addLeaves(xpathQuery, payload);
        expect(xpathQuery).to.equal(validXpathQuery);
    });

    it("should properly convert XPATH to JSON", async function () {
        let xpathQuery = "ietf-interfaces:interfaces/interface[name=interface100]";
        const NSs = {
            "ietf-interfaces": "urn:ietf:params:xml:ns:yang:ietf-interfaces",
            "iana-if-type": "urn:ietf:params:xml:ns:yang:iana-if-type",
        };

        let objRequest = xpath2json.xpath2json(xpathQuery, NSs);
        const validObject1 = {
            "ietf-interfaces:interfaces": { interface: { name: "interface100" } },
        };
        expect(JSON.stringify(objRequest)).to.equal(JSON.stringify(validObject1));

        const payload = { value: "modem" };
        xpathQuery = xpath2json.addLeaves(xpathQuery, payload);
        objRequest = xpath2json.xpath2json(xpathQuery, NSs);
        const validObject2 = {
            "ietf-interfaces:interfaces": { interface: { name: "interface100", value: "modem" } },
        };
        expect(JSON.stringify(objRequest)).to.equal(JSON.stringify(validObject2));
    });

    it("should properly convert JSON to XPATH", async function () {
        const xpathQuery = '/ietf-interfaces:interfaces/interface[name="interface100"][value="modem"]';
        const object = {
            "ietf-interfaces:interfaces": { interface: { name: "interface100", value: "modem" } },
        };
        const jsonString = xpath2json.json2xpath(object, 0, []);
        let jsonXpath = jsonString[0] !== "[" ? "/" : ""; // let's check if the first argument is a leaf
        for (let i = 0; i < jsonString.length; i++) {
            jsonXpath += jsonString[i];
        }
        expect(jsonXpath).to.equal(xpathQuery);
    });
});

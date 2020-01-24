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

import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

const chai = require('chai')
    , spies = require('chai-spies');

chai.use(spies)

import { ContentSerdes } from "@node-wot/core";

import NetconfClient from "../src/netconf-client";
import { BaseSchema } from "@node-wot/td-tools";
import * as xpath2json from '../src/xpath2json';





describe('outer describe', function () {


    let client: NetconfClient = new NetconfClient();

    it("should apply security", async function () {
        let metadata = [{ scheme: 'nosec' }];
        let credentials = {
            "username": "user",
            "password": "test"
        }
        client.setSecurity(metadata, credentials);
        return;
    })


    it("should fail to read a property because of no connection to server", async function () {

        let inputVector = {
            "form": {
                "href": "netconf://localhost:6060/ietf-ip:ipv6/address",
                "contentType": "application/json",
                "op": [
                    "readproperty",
                ],
                "nc:target": "running",
                "nc:NSs": {
                    "ietf-ip": "urn:ietf:params:xml:ns:yang:ietf-ip"
                }
            },
            "nc:method": "GET-CONFIG"
        };
        try {
            let res = await client.readResource(inputVector.form);
        } catch (err) {
            expect(err.message).to.equal("connect ECONNREFUSED 127.0.0.1:6060");
        }
        return;
    })

    it("should fail to write a property because of no connection to server", async function () {

        let inputVector = {
            form: {
                "href": "netconf://localhost:6060/ietf-interfaces:interfaces/interface[name=interface100]",
                "contentType": "application/json",
                "op": [
                    "writeproperty"
                ],
                "nc:target": "candidate",
                "nc:NSs": {
                    "ietf-interfaces": "urn:ietf:params:xml:ns:yang:ietf-interfaces"
                }
            },
            "nc:method": "EDIT-CONFIG"
        }

        let payload = { type: { xmlns: "urn:ietf:params:xml:ns:yang:iana-if-type", value: "modem" } };

        let schema = {
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
        }

        try {
            let res = await client.writeResource(inputVector.form, { type: ContentSerdes.DEFAULT, body: Buffer.from(JSON.stringify(payload)) }, <BaseSchema>schema);
        } catch (err) {
            expect(err.message).to.equal("connect ECONNREFUSED 127.0.0.1:6060");
        }
        return;
    })

    it("should fail to invoke an action because of no connection to server", async function () {

        let inputVector = {
            form: {
                "href": "netconf://localhost:6060/",
                "method": "COMMIT",
                "contentType": "application/json",
                "op": [
                    "invokeaction"
                ],
                "nc:target": "candidate",
                "nc:NSs": {
                    "ietf-interfaces": "urn:ietf:params:xml:ns:yang:ietf-interfaces"
                }
            },
            "nc:method": "RPC"
        }
        let payload = "commit";

        try {
            let res = await client.invokeResource(inputVector.form, { type: ContentSerdes.DEFAULT, body: Buffer.from(JSON.stringify(payload)) }, null);
        } catch (err) {
            expect(err.message).to.equal("connect ECONNREFUSED 127.0.0.1:6060");
        }
        return;
    })

    it("should properly add leaves to XPATH", async function () {
        let xpath_query = '/ietf-interfaces:interfaces/interface';
        let payload = { name: "interface100" };
        let valid_xpath_query = '/ietf-interfaces:interfaces/interface[name="interface100"]';
        xpath_query = xpath2json.addLeaves(xpath_query, payload);
        expect(xpath_query).to.equal(valid_xpath_query);
    })


    it("should properly convert XPATH to JSON", async function () {
        let xpath_query = 'ietf-interfaces:interfaces/interface[name=interface100]';
        let NSs = {
            "ietf-interfaces": "urn:ietf:params:xml:ns:yang:ietf-interfaces",
            "iana-if-type": "urn:ietf:params:xml:ns:yang:iana-if-type"
        }

        let obj_request = xpath2json.xpath2json(xpath_query, NSs);
        let valid_object: any = {
            'ietf-interfaces:interfaces': { interface: { name: 'interface100' } }
        }
        expect(JSON.stringify(obj_request)).to.equal(JSON.stringify(valid_object));

        let payload = { value: "modem" };
        xpath_query = xpath2json.addLeaves(xpath_query, payload);
        obj_request = xpath2json.xpath2json(xpath_query, NSs);
        valid_object = {
            'ietf-interfaces:interfaces': { interface: { name: 'interface100', value: 'modem' } }
        }
        expect(JSON.stringify(obj_request)).to.equal(JSON.stringify(valid_object));
        return;
    })


    it("should properly convert JSON to XPATH", async function () {
        let xpath_query = '/ietf-interfaces:interfaces/interface[name="interface100"][value="modem"]';
        let object: any = {
            'ietf-interfaces:interfaces': { interface: { name: 'interface100', value: 'modem' } }
        }
        let json_string = xpath2json.json2xpath(object, 0, []);
        var json_xpath = json_string[0] !== '[' ? '/' : ''; //let's check if the first argument is a leaf
        for (var i = 0; i < json_string.length; i++) {
            json_xpath += json_string[i];
        }
        expect(json_xpath).to.equal(xpath_query);
    })

});
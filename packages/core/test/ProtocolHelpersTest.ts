/* eslint-disable no-unused-expressions */
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
 * Basic test suite for helper functions
 * uncomment the @skip to see failing tests
 *
 */

import { suite, test } from "@testdeck/mocha";
import * as TD from "@node-wot/td-tools";
import { expect } from "chai";
import { ProtocolHelpers } from "@node-wot/core";

@suite("Protocol Helpers")
class ProtocolHelpersTest {
    @test "should get form index "() {
        const forms: TD.Form[] = [
            {
                href: "http://example.com/test/properties/test1?param=test",
                contentType: "text/plain",
            },
            {
                href: "http://example.com/test/properties/test2",
                contentType: "text/plain",
            },
            {
                href: "coap://example.com/test/properties/test3",
                contentType: "text/plain",
            },
            {
                href: "coap://example.com/test/properties/test3",
                contentType: "application/json",
            },
        ];

        let requestUrl = "/test/properties/test1";
        const contentType = "application/json";
        let formIndex = ProtocolHelpers.findRequestMatchingFormIndex(forms, "http", requestUrl, contentType);
        expect(formIndex).to.be.equal(0);

        requestUrl = "/test/properties/test2";
        formIndex = ProtocolHelpers.findRequestMatchingFormIndex(forms, "http", requestUrl, contentType);
        expect(formIndex).to.be.equal(1);

        requestUrl = "/test/properties/test3";
        formIndex = ProtocolHelpers.findRequestMatchingFormIndex(forms, "coap", requestUrl, contentType);
        expect(formIndex).to.be.equal(3);
    }

    @test "should get form index with defaults for property"() {
        const tp: TD.ThingProperty = {
            title: "test",
            forms: [
                {
                    href: "http://exmaple.com/test1",
                    contentType: "application/json",
                },
                {
                    href: "http://exmaple.com/test2",
                    contentType: "application/xml",
                    op: ["writeallproperties", "writeproperty"],
                },
                {
                    href: "http://exmaple.com/test3",
                    contentType: "application/octet-steam",
                    op: "readallproperties",
                },
                {
                    href: "http://exmaple.com/test4",
                    contentType: "application/json",
                    op: ["readmultipleproperties"],
                },
                {
                    href: "http://exmaple.com/test5",
                    contentType: "application/json",
                    op: "readproperty",
                },
            ],
        };

        let formIndex = ProtocolHelpers.getFormIndexForOperation(tp, "property", "readproperty", 3);
        expect(tp.forms[formIndex].href).to.be.equal("http://exmaple.com/test4");

        formIndex = ProtocolHelpers.getFormIndexForOperation(tp, "property", "writeproperty", 123);
        expect(tp.forms[formIndex].href).to.be.equal("http://exmaple.com/test1");

        formIndex = ProtocolHelpers.getFormIndexForOperation(tp, "property", "readmultipleproperties", 1);
        expect(tp.forms[formIndex].href).to.be.equal("http://exmaple.com/test4");

        formIndex = ProtocolHelpers.getFormIndexForOperation(tp, "property", "readallproperties", 5);
        expect(tp.forms[formIndex].href).to.be.equal("http://exmaple.com/test3");

        tp.readOnly = true;
        formIndex = ProtocolHelpers.getFormIndexForOperation(tp, "property", "writeproperty", 123);
        expect(tp.forms[formIndex]).to.be.undefined;

        tp.writeOnly = true;
        formIndex = ProtocolHelpers.getFormIndexForOperation(tp, "property", "readproperty", 1);
        expect(tp.forms[formIndex]).to.be.undefined;
    }

    @test "should get form index with defaults for action"() {
        const ta: TD.ThingAction = {
            title: "test",
            forms: [
                {
                    href: "http://exmaple.com/test1",
                    contentType: "application/json",
                },
                {
                    href: "http://exmaple.com/test2",
                    contentType: "application/xml",
                    op: ["invokeaction"],
                },
                {
                    href: "http://exmaple.com/test3",
                    contentType: "application/xml",
                    op: "invokeaction",
                },
            ],
        };

        const formIndex = ProtocolHelpers.getFormIndexForOperation(ta, "action", "invokeaction", 2);
        expect(ta.forms[formIndex].href).to.be.equal("http://exmaple.com/test3");
    }

    @test "should get form index with defaults for event"() {
        const te: TD.ThingEvent = {
            title: "test",
            forms: [
                {
                    href: "http://exmaple.com/test1",
                    contentType: "application/json",
                },
                {
                    href: "http://exmaple.com/test2",
                    contentType: "application/xml",
                    op: ["subscribeevent", "unsubscribeevent"],
                },
                {
                    href: "http://exmaple.com/test3",
                    contentType: "application/xml",
                    op: "subscribeevent",
                },
            ],
        };

        let formIndex = ProtocolHelpers.getFormIndexForOperation(te, "event", "subscribeevent", 2);
        expect(te.forms[formIndex].href).to.be.equal("http://exmaple.com/test3");

        formIndex = ProtocolHelpers.getFormIndexForOperation(te, "event", "unsubscribeevent", 0);
        expect(te.forms[formIndex].href).to.be.equal("http://exmaple.com/test1");
    }
}

/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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
import { expect } from "chai";

import { AssetInterfaceDescriptionUtil } from "../src/util/asset-interface-description";
import { promises as fs } from "fs";

@suite("tests to verify the Asset Interface Description Utils")
class ThingModelHelperTest {
    private assetInterfaceDescriptionUtil = new AssetInterfaceDescriptionUtil();

    @test async "should correctly transform sample JSON AID_v03 into a TD"() {
        const modelAID = (await fs.readFile("test/util/AID_v03.json")).toString();
        const td = this.assetInterfaceDescriptionUtil.transformToTD(modelAID);

        const tdObj = JSON.parse(td);
        console.log(JSON.stringify(tdObj, null, 2));
        // TODO proper TD validation based on playground and/or JSON schema?
        expect(tdObj).to.have.property("@context").that.equals("https://www.w3.org/2022/wot/td/v1.1");
        expect(tdObj).to.have.property("properties").to.have.property("voltage");

        // form entries
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("voltage")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(4);
        // Modbus
        expect(tdObj.properties.voltage.forms[0]).to.have.property("href").to.eql("modbus+tcp://192.168.1.187:502");
        expect(tdObj.properties.voltage.forms[0])
            .to.have.property("contentType")
            .to.eql("application/octet-stream;byteSeq=BIG_ENDIAN");
        expect(tdObj.properties.voltage.forms[0]).to.have.property("modbus:function").to.eql("readHoldingRegisters");
        expect(tdObj.properties.voltage.forms[0]).to.have.property("modbus:address").to.eql("40001");
        expect(tdObj.properties.voltage.forms[0]).to.have.property("modbus:quantity").to.eql("2"); // not a proper number in AID -> valueType *not* set
        // HTTP
        expect(tdObj.properties.voltage.forms[1])
            .to.have.property("href")
            .to.eql("https://192.168.1.187" + "/properties/voltage");
        expect(tdObj.properties.voltage.forms[1]).to.have.property("htv:methodName").to.eql("GET");
        expect(tdObj.properties.voltage.forms[1]).to.have.property("contentType").to.eql("text/xml"); // Note: "application/json" overridden locally
        expect(tdObj.properties.voltage.forms[1]).to.have.property("subprotocol").to.eql("longpoll");
        // OPC
        expect(tdObj.properties.voltage.forms[2])
            .to.have.property("href")
            .to.eql("opc.tcp://192.168.1.187:4840/UAserver");
        expect(tdObj.properties.voltage.forms[2]).to.have.property("contentType").to.eql("application/x.opcua.binary");
        expect(tdObj.properties.voltage.forms[2]).to.have.property("ua:nodeId").to.eql('"ns=3;i=29"');
        expect(tdObj.properties.voltage.forms[2])
            .to.have.property("ua:expandedNodeId")
            .to.eql(' "nsu=http://example.com/OPCUAServer/energy;i=29"');
        expect(tdObj.properties.voltage.forms[2]).to.have.property("ua:method").to.eql("READ");
        // MQTT
        expect(tdObj.properties.voltage.forms[3]).to.have.property("href").to.eql("mqtt://test.mosquitto:1884");
        expect(tdObj.properties.voltage.forms[3]).to.have.property("contentType").to.eql("application/json");
        expect(tdObj.properties.voltage.forms[3])
            .to.have.property("mqv:topic")
            .to.eql("/devices/thing1/properties/voltage");
        expect(tdObj.properties.voltage.forms[3]).to.have.property("mqv:controlPacket").to.eql("mqv:subscribe");
        expect(tdObj.properties.voltage.forms[3]).to.have.property("mqv:retain").to.eql(true); // value is string but valueType states boolean
    }
}

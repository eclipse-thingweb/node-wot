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

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";

import { AssetInterfaceDescriptionUtil } from "../src/util/asset-interface-description";
import { promises as fs } from "fs";
import { ThingDescription } from "wot-typescript-definitions";

@suite("tests to verify the Asset Interface Description Utils")
class AssetInterfaceDescriptionUtilTest {
    private assetInterfaceDescriptionUtil = new AssetInterfaceDescriptionUtil();

    @test.skip async "should correctly transform sample JSON AID_submodel HTTP v03 into a TD"() {
        const modelFullString = await (await fs.readFile("test/util/AID_v03.json")).toString();
        const modelFull = JSON.parse(modelFullString);
        const modelSub = modelFull.submodels[1];

        // submodel only + HTTP only
        const td = this.assetInterfaceDescriptionUtil.transformSM2TD(
            JSON.stringify(modelSub),
            `{"title": "myTitle", "id": "urn:uuid:3deca264-4f90-4321-a5ea-f197e6a1c7cf"}`,
            "HTTP"
        );
        const tdObj = JSON.parse(td);
        // console.log(JSON.stringify(tdObj, null, 2));

        // security
        expect(tdObj).to.have.property("security").to.be.an("array").to.have.lengthOf(2);
        expect(tdObj.securityDefinitions[tdObj.security[0]]).to.have.property("scheme").that.equals("basic");
        expect(tdObj.securityDefinitions[tdObj.security[1]]).to.have.property("scheme").that.equals("oauth2");
        // form entries limited to 1
        expect(tdObj).to.have.property("properties").to.have.property("voltage");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("voltage")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);
    }

    @test.skip async "should correctly transform sample JSON AID_v03 into a TD"() {
        const modelAID = (await fs.readFile("test/util/AID_v03.json")).toString();
        const td = this.assetInterfaceDescriptionUtil.transformAAS2TD(
            modelAID,
            `{"title": "myTitle", "id": "urn:uuid:3deca264-4f90-4321-a5ea-f197e6a1c7cf"}`
        );

        const tdObj = JSON.parse(td);
        // console.log(JSON.stringify(tdObj, null, 2));
        // TODO proper TD validation based on playground and/or JSON schema?
        expect(tdObj).to.have.property("@context").that.equals("https://www.w3.org/2022/wot/td/v1.1");
        expect(tdObj).to.have.property("title").that.equals("myTitle");
        expect(tdObj).to.have.property("id").that.equals("urn:uuid:3deca264-4f90-4321-a5ea-f197e6a1c7cf");

        expect(tdObj).to.have.property("security").to.be.an("array").to.have.lengthOf(5);
        // Security Modbus
        expect(tdObj.securityDefinitions[tdObj.security[0]]).to.have.property("scheme").that.equals("nosec");
        // Security HTTP
        expect(tdObj.securityDefinitions[tdObj.security[1]]).to.have.property("scheme").that.equals("basic");
        expect(tdObj.securityDefinitions[tdObj.security[1]]).to.have.property("in").that.equals("header");
        expect(tdObj.securityDefinitions[tdObj.security[2]]).to.have.property("scheme").that.equals("oauth2");
        expect(tdObj.securityDefinitions[tdObj.security[2]]).to.have.property("flow").that.equals("client");
        expect(tdObj.securityDefinitions[tdObj.security[2]])
            .to.have.property("token")
            .that.equals("https://example.com/token");
        expect(tdObj.securityDefinitions[tdObj.security[2]]).to.have.property("scopes").that.equals("limited");
        // Security OPC
        expect(tdObj.securityDefinitions[tdObj.security[3]]).to.have.property("scheme").that.equals("uasec");
        expect(tdObj.securityDefinitions[tdObj.security[3]])
            .to.have.property("mode")
            .that.equals('["none", "Sign", "Sign & Encrypt"]');
        expect(tdObj.securityDefinitions[tdObj.security[3]])
            .to.have.property("policy")
            .that.equals('["none", "Basic128RSA15", "Basic256", "Basic256SHA256"]');
        // Security MQTT
        expect(tdObj.securityDefinitions[tdObj.security[4]]).to.have.property("scheme").that.equals("basic");
        expect(tdObj.securityDefinitions[tdObj.security[4]]).to.have.property("in").that.equals("header");

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
        expect(tdObj.properties.voltage.forms[0]).to.have.property("security").to.deep.equal(["0_sc"]);
        // HTTP
        expect(tdObj.properties.voltage.forms[1])
            .to.have.property("href")
            .to.eql("https://192.168.1.187" + "/properties/voltage");
        expect(tdObj.properties.voltage.forms[1]).to.have.property("htv:methodName").to.eql("GET");
        expect(tdObj.properties.voltage.forms[1]).to.have.property("contentType").to.eql("text/xml"); // Note: "application/json" overridden locally
        expect(tdObj.properties.voltage.forms[1]).to.have.property("subprotocol").to.eql("longpoll");
        expect(tdObj.properties.voltage.forms[1]).to.have.property("security").to.deep.equal(["1_sc", "2_sc"]);
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
        expect(tdObj.properties.voltage.forms[2]).to.have.property("security").to.deep.equal(["3_sc"]);
        // MQTT
        expect(tdObj.properties.voltage.forms[3]).to.have.property("href").to.eql("mqtt://test.mosquitto:1884");
        expect(tdObj.properties.voltage.forms[3]).to.have.property("contentType").to.eql("application/json");
        expect(tdObj.properties.voltage.forms[3])
            .to.have.property("mqv:topic")
            .to.eql("/devices/thing1/properties/voltage");
        expect(tdObj.properties.voltage.forms[3]).to.have.property("mqv:controlPacket").to.eql("mqv:subscribe");
        expect(tdObj.properties.voltage.forms[3]).to.have.property("mqv:retain").to.eql(true); // value is string but valueType states boolean
        expect(tdObj.properties.voltage.forms[3]).to.have.property("security").to.deep.equal(["4_sc"]);

        // filter HTTP submodel only
        const td2 = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "myTitle"}`, "HTTP");
        const td2Obj = JSON.parse(td2);
        // security
        expect(td2Obj).to.have.property("security").to.be.an("array").to.have.lengthOf(2);
        expect(td2Obj.securityDefinitions[td2Obj.security[0]]).to.have.property("scheme").that.equals("basic");
        expect(td2Obj.securityDefinitions[td2Obj.security[1]]).to.have.property("scheme").that.equals("oauth2");
        // form entries limited to 1
        expect(td2Obj).to.have.property("properties").to.have.property("voltage");
        expect(td2Obj)
            .to.have.property("properties")
            .to.have.property("voltage")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);

        // filter Modbus and HTTP and submodel only
        const td3 = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "myTitle"}`, "Modbus|HTTP");
        const td3Obj = JSON.parse(td3);
        // security
        expect(td3Obj).to.have.property("security").to.be.an("array").to.have.lengthOf(3);
        expect(td3Obj.securityDefinitions[td3Obj.security[0]]).to.have.property("scheme").that.equals("nosec");
        expect(td3Obj.securityDefinitions[td3Obj.security[1]]).to.have.property("scheme").that.equals("basic");
        expect(td3Obj.securityDefinitions[td3Obj.security[2]]).to.have.property("scheme").that.equals("oauth2");
        // form entries limited to 2
        expect(td3Obj).to.have.property("properties").to.have.property("voltage");
        expect(td3Obj)
            .to.have.property("properties")
            .to.have.property("voltage")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(2);
    }

    @test.skip async "should correctly transform sample JSON AID_v03 for counter into a TD"() {
        const modelAID = (await fs.readFile("test/util/AID_v03_counter.json")).toString();
        const td = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "counter"}`);

        const tdObj = JSON.parse(td);
        // console.log(JSON.stringify(tdObj, null, 2));
        // TODO proper TD validation based on playground and/or JSON schema?
        expect(tdObj).to.have.property("@context").that.equals("https://www.w3.org/2022/wot/td/v1.1");
        expect(tdObj).to.have.property("title").that.equals("counter");

        expect(tdObj).to.have.property("security").to.be.an("array").to.have.lengthOf(1);
        expect(tdObj.securityDefinitions[tdObj.security[0]]).to.have.property("scheme").that.equals("nosec");

        expect(tdObj).to.have.property("properties").to.have.property("count");
        // to check if count properties has type element that is equals the value defined in AID->integer
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("count")
            .to.have.property("type")
            .that.equals("integer");

        // form entries
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("count")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);
        // HTTP
        expect(tdObj.properties.count.forms[0])
            .to.have.property("href")
            .to.eql("http://plugfest.thingweb.io:8083/counter" + "/properties/count");
        expect(tdObj.properties.count.forms[0]).to.have.property("htv:methodName").to.eql("GET");
        expect(tdObj.properties.count.forms[0]).to.have.property("contentType").to.eql("application/json");
        // security not needed at form level in this case
        expect(tdObj.properties.count.forms[0]).not.to.have.property("security");

        // TODO actions and events for counter thing

        // check RegEx capability with fully qualified submodel
        const td2 = this.assetInterfaceDescriptionUtil.transformAAS2TD(
            modelAID,
            `{"title": "counter"}`,
            "InterfaceHTTP"
        );
        const td2Obj = JSON.parse(td2);
        expect(tdObj).to.deep.equal(td2Obj);

        // check RegEx capability with search pattern for submodel
        const td3 = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "counter"}`, "HTTP*");
        const td3Obj = JSON.parse(td3);
        expect(tdObj).to.deep.equal(td3Obj);

        // check RegEx capability with fully unknown submodel
        const td4 = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "counter"}`, "OPC*");
        const td4Obj = JSON.parse(td4);
        expect(td4Obj).to.not.have.property("properties");
    }

    @test async "should correctly transform counterHTTP_minimal into a TD"() {
        const modelAID = (await fs.readFile("test/util/counterHTTP.json")).toString();
        const td = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "counter"}`);

        const tdObj = JSON.parse(td);
        expect(tdObj).to.have.property("@context").that.equals("https://www.w3.org/2022/wot/td/v1.1");
        expect(tdObj).to.have.property("title").that.equals("counter");

        expect(tdObj).to.have.property("securityDefinitions").to.be.an("object");

        expect(tdObj).to.have.property("security").to.be.an("array").to.have.lengthOf(1);
        expect(tdObj.securityDefinitions[tdObj.security[0]]).to.have.property("scheme").that.equals("nosec");

        // check count property
        expect(tdObj).to.have.property("properties").to.have.property("count");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("count")
            .to.have.property("type")
            .that.equals("integer");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("count")
            .to.have.property("title")
            .that.equals("Count");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("count")
            .to.have.property("observable")
            .that.equals(true);
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("count")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);
        expect(tdObj.properties.count.forms[0])
            .to.have.property("href")
            .to.eql("http://plugfest.thingweb.io:8083/counter" + "/properties/count");
        expect(tdObj.properties.count.forms[0]).to.have.property("htv:methodName").to.eql("GET");
        expect(tdObj.properties.count.forms[0]).to.have.property("contentType").to.eql("application/json");
        expect(tdObj.properties.count.forms[0]).not.to.have.property("security");

        // check countAsImage property
        expect(tdObj).to.have.property("properties").to.have.property("countAsImage");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("countAsImage")
            .to.have.property("observable")
            .that.equals(false);
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("countAsImage")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);
        expect(tdObj.properties.countAsImage.forms[0])
            .to.have.property("href")
            .to.eql("http://plugfest.thingweb.io:8083/counter" + "/properties/countAsImage");
        expect(tdObj.properties.countAsImage.forms[0]).to.have.property("htv:methodName").to.eql("GET");
        expect(tdObj.properties.countAsImage.forms[0]).to.have.property("contentType").to.eql("image/svg+xml");
        expect(tdObj.properties.countAsImage.forms[0]).not.to.have.property("security");

        // check redDotImage property
        expect(tdObj).to.have.property("properties").to.have.property("redDotImage");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("redDotImage")
            .to.have.property("observable")
            .that.equals(false);
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("redDotImage")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);
        expect(tdObj.properties.redDotImage.forms[0])
            .to.have.property("href")
            .to.eql("http://plugfest.thingweb.io:8083/counter" + "/properties/redDotImage");
        expect(tdObj.properties.redDotImage.forms[0]).to.have.property("htv:methodName").to.eql("GET");
        expect(tdObj.properties.redDotImage.forms[0]).to.have.property("contentType").to.eql("image/png;base64");
        expect(tdObj.properties.redDotImage.forms[0]).not.to.have.property("security");

        // check count property
        expect(tdObj).to.have.property("properties").to.have.property("lastChange");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("lastChange")
            .to.have.property("type")
            .that.equals("string");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("lastChange")
            .to.have.property("title")
            .that.equals("Last change");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("lastChange")
            .to.have.property("observable")
            .that.equals(true);
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("lastChange")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);
        expect(tdObj.properties.lastChange.forms[0])
            .to.have.property("href")
            .to.eql("http://plugfest.thingweb.io:8083/counter" + "/properties/lastChange");
        expect(tdObj.properties.lastChange.forms[0]).to.have.property("htv:methodName").to.eql("GET");
        expect(tdObj.properties.lastChange.forms[0]).to.have.property("contentType").to.eql("application/json");
        expect(tdObj.properties.lastChange.forms[0]).not.to.have.property("security");

        // TODO actions and events for counter thing (TBD by AAS)

        // check RegEx capability with fully qualified submodel
        const td2 = this.assetInterfaceDescriptionUtil.transformAAS2TD(
            modelAID,
            `{"title": "counter"}`,
            "InterfaceHTTP"
        );
        const td2Obj = JSON.parse(td2);
        expect(tdObj).to.deep.equal(td2Obj);

        // check RegEx capability with search pattern for submodel
        const td3 = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "counter"}`, "HTTP*");
        const td3Obj = JSON.parse(td3);
        expect(tdObj).to.deep.equal(td3Obj);

        // check RegEx capability with fully unknown submodel
        const td4 = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "counter"}`, "OPC*");
        const td4Obj = JSON.parse(td4);
        expect(td4Obj).to.not.have.property("properties");
    }

    td1Base = "https://www.example.com/";
    td1: ThingDescription = {
        "@context": "https://www.w3.org/2022/wot/td/v1.1",
        title: "testTD",
        securityDefinitions: {
            basic_sc: {
                scheme: "basic",
                in: "header",
            },
        },
        security: "basic_sc",
        base: this.td1Base,
        properties: {
            status: {
                type: "string",
                observable: true,
                forms: [
                    {
                        href: "stat",
                        contentType: "application/json",
                        "htv:methodName": "GET",
                        op: ["readproperty"],
                    },
                ],
            },
        },
    };

    @test async "should correctly transform sample TD into JSON submodel"() {
        const sm = this.assetInterfaceDescriptionUtil.transformTD2SM(JSON.stringify(this.td1), "http");

        const smObj = JSON.parse(sm);
        expect(smObj).to.have.property("idShort").that.equals("AssetInterfacesDescription");
        expect(smObj).to.have.property("submodelElements").to.be.an("array").to.have.lengthOf.greaterThan(0);
        const smInterface = smObj.submodelElements[0];
        expect(smInterface).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
        let hasEndpointMetadata = false;
        for (const smValue of smInterface.value) {
            if (smValue.idShort === "EndpointMetadata") {
                hasEndpointMetadata = true;
                const endpointMetadata = smValue;
                expect(endpointMetadata).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
                let hasBase = false;
                let hasContentType = false;
                let hasSecurity = false;
                let hasSecurityDefinitions = false;
                for (const endpointMetadataValue of endpointMetadata.value) {
                    if (endpointMetadataValue.idShort === "base") {
                        hasBase = true;
                        expect(endpointMetadataValue.value).to.equal(this.td1Base);
                    } else if (endpointMetadataValue.idShort === "contentType") {
                        hasContentType = true;
                    } else if (endpointMetadataValue.idShort === "security") {
                        hasSecurity = true;
                        expect(endpointMetadataValue)
                            .to.have.property("value")
                            .to.be.an("array")
                            .to.have.lengthOf.greaterThan(0);
                        expect(endpointMetadataValue.value[0].value).to.equal("basic_sc");
                    } else if (endpointMetadataValue.idShort === "securityDefinitions") {
                        hasSecurityDefinitions = true;
                        expect(endpointMetadataValue)
                            .to.have.property("value")
                            .to.be.an("array")
                            .to.have.lengthOf.greaterThan(0);
                        let hasBasicSC = false;
                        for (const securityDefinitionValue of endpointMetadataValue.value) {
                            if (securityDefinitionValue.idShort === "basic_sc") {
                                hasBasicSC = true;
                                expect(securityDefinitionValue)
                                    .to.have.property("value")
                                    .to.be.an("array")
                                    .to.have.lengthOf.greaterThan(0);
                                let hasBasic = false;
                                for (const sec of securityDefinitionValue.value) {
                                    if (sec.idShort === "scheme") {
                                        hasBasic = true;
                                        expect(sec.value).to.equal("basic");
                                    }
                                }
                                expect(hasBasic).to.equal(true);
                            }
                        }
                        expect(hasBasicSC).to.equal(true);
                    }
                }
                expect(hasBase).to.equal(true);
                expect(hasContentType).to.equal(false);
                expect(hasSecurity).to.equal(true);
                expect(hasSecurityDefinitions).to.equal(true);
            }
        }
        expect(hasEndpointMetadata, "No EndpointMetadata").to.equal(true);

        // InterfaceMetadata with properties etc
        let hasInterfaceMetadata = false;
        for (const smValue of smInterface.value) {
            if (smValue.idShort === "InterfaceMetadata") {
                hasInterfaceMetadata = true;
                expect(smValue).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
                let hasProperties = false;
                for (const interactionValues of smValue.value) {
                    if (interactionValues.idShort === "Properties") {
                        hasProperties = true;
                        expect(interactionValues)
                            .to.have.property("value")
                            .to.be.an("array")
                            .to.have.lengthOf.greaterThan(0);
                        let hasPropertyStatus = false;
                        for (const propertyValue of interactionValues.value) {
                            if (propertyValue.idShort === "status") {
                                hasPropertyStatus = true;
                                expect(propertyValue)
                                    .to.have.property("value")
                                    .to.be.an("array")
                                    .to.have.lengthOf.greaterThan(0);
                                let hasType = false;
                                let hasTitle = false;
                                let hasObservable = false;
                                let hasForms = false;
                                for (const propProperty of propertyValue.value) {
                                    if (propProperty.idShort === "type") {
                                        hasType = true;
                                        expect(propProperty.value).to.equal("string");
                                    } else if (propProperty.idShort === "title") {
                                        hasTitle = true;
                                    } else if (propProperty.idShort === "observable") {
                                        hasObservable = true;
                                        expect(propProperty.value).to.equal("true");
                                    } else if (propProperty.idShort === "forms") {
                                        hasForms = true;
                                        expect(propProperty)
                                            .to.have.property("value")
                                            .to.be.an("array")
                                            .to.have.lengthOf.greaterThan(0);
                                        let hasHref = false;
                                        let hasContentType = false;
                                        let hasHtvMethodName = false;
                                        // let hasOp = false;
                                        for (const formEntry of propProperty.value) {
                                            if (formEntry.idShort === "href") {
                                                hasHref = true;
                                                expect(formEntry.value).to.be.oneOf([
                                                    "stat",
                                                    "https://www.example.com/stat",
                                                ]);
                                            } else if (formEntry.idShort === "contentType") {
                                                hasContentType = true;
                                                expect(formEntry.value).to.equal("application/json");
                                            } else if (formEntry.idShort === "htv:methodName") {
                                                hasHtvMethodName = true;
                                                expect(formEntry.value).to.equal("GET");
                                                // } else if (formEntry.idShort === "op") {
                                                //     hasOp = true;
                                                //     expect(formEntry.value).to.have.members(["readproperty"]);
                                            }
                                        }
                                        expect(hasHref).to.equal(true);
                                        expect(hasContentType).to.equal(true);
                                        expect(hasHtvMethodName).to.equal(true);
                                        // expect(hasOp).to.equal(true);
                                    }
                                }
                                expect(hasType).to.equal(true);
                                expect(hasTitle).to.equal(false);
                                expect(hasObservable).to.equal(true);
                                expect(hasForms).to.equal(true);
                            }
                        }
                        expect(hasPropertyStatus).to.equal(true);
                    }
                }
                expect(hasProperties).to.equal(true);
            }
        }
        expect(hasInterfaceMetadata, "No InterfaceMetadata").to.equal(true);
    }

    @test
    async "should transform sample TD into JSON submodel without any properties due to unknown protocol prefix"() {
        const sm = this.assetInterfaceDescriptionUtil.transformTD2SM(JSON.stringify(this.td1), "unknown");

        const smObj = JSON.parse(sm);
        expect(smObj).to.have.property("idShort").that.equals("AssetInterfacesDescription");
        expect(smObj).to.have.property("submodelElements").to.be.an("array").to.have.lengthOf.greaterThan(0);
        const smInterface = smObj.submodelElements[0];
        expect(smInterface).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);

        // InterfaceMetadata with *no* properties for this protocol
        let hasInterfaceMetadata = false;
        for (const smValue of smInterface.value) {
            if (smValue.idShort === "InterfaceMetadata") {
                hasInterfaceMetadata = true;
                expect(smValue).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
                for (const interactionValues of smValue.value) {
                    if (interactionValues.idShort === "Properties") {
                        expect(interactionValues).to.have.property("value").to.be.an("array").to.have.lengthOf(0);
                    }
                }
            }
        }
        expect(hasInterfaceMetadata, "No InterfaceMetadata").to.equal(true);
    }

    @test async "should correctly transform sample TD into JSON AAS"() {
        const sm = this.assetInterfaceDescriptionUtil.transformTD2AAS(JSON.stringify(this.td1), ["http"]);

        const aasObj = JSON.parse(sm);
        expect(aasObj).to.have.property("assetAdministrationShells").to.be.an("array");
        expect(aasObj).to.have.property("submodels").to.be.an("array").to.have.lengthOf(1);

        // Note: proper AID submodel checks done in previous test-cases
    }

    @test async "should correctly transform counter TD into JSON AAS"() {
        const response = await fetch("http://plugfest.thingweb.io:8083/counter");
        const counterTD = await response.json();

        const sm = this.assetInterfaceDescriptionUtil.transformTD2AAS(JSON.stringify(counterTD), ["http", "coap"]);

        const aasObj = JSON.parse(sm);
        expect(aasObj).to.have.property("assetAdministrationShells").to.be.an("array");
        expect(aasObj).to.have.property("submodels").to.be.an("array").to.have.lengthOf(2);

        // TODO proper AID submodel checks
        console.log("XXX\n\n");
        console.log(JSON.stringify(aasObj));
        console.log("\n\nXXX");
    }
}

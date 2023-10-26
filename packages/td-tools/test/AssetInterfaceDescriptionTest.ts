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

    @test async "should correctly transform counterHTTP into a TD"() {
        const modelAID = (await fs.readFile("test/util/counterHTTP.json")).toString();
        const td = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "bla"}`);

        const tdObj = JSON.parse(td);
        expect(tdObj).to.have.property("@context").that.equals("https://www.w3.org/2022/wot/td/v1.1");
        expect(tdObj).to.have.property("title").that.equals("Counter"); // should come form AAS
        expect(tdObj).to.have.property("support").that.equals("https://github.com/eclipse-thingweb/node-wot/");

        expect(tdObj).to.have.property("securityDefinitions").to.be.an("object");

        expect(tdObj).to.have.property("security").to.be.an("array").to.have.lengthOf(1);
        expect(tdObj.securityDefinitions[tdObj.security[0]]).to.have.property("scheme").that.equals("nosec");

        // check count property
        expect(tdObj).to.have.property("properties").to.have.property("count");
        expect(tdObj).to.have.property("properties").to.have.property("count").to.have.property("descriptions").to.eql({
            en: "Current counter value",
            de: "Derzeitiger Zählerwert",
            it: "Valore attuale del contatore",
        });
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

    @test async "should correctly transform inverterModbus into a TD"() {
        const modelAID = (await fs.readFile("test/util/inverterModbus.json")).toString();
        const td = this.assetInterfaceDescriptionUtil.transformAAS2TD(modelAID, `{"title": "bla"}`);

        const tdObj = JSON.parse(td);
        expect(tdObj).to.have.property("@context").that.equals("https://www.w3.org/2022/wot/td/v1.1");
        expect(tdObj).to.have.property("title").that.equals("Inverter GEN44"); // should come form AAS

        expect(tdObj).to.have.property("securityDefinitions").to.be.an("object");

        expect(tdObj).to.have.property("security").to.be.an("array").to.have.lengthOf(1);
        expect(tdObj.securityDefinitions[tdObj.security[0]]).to.have.property("scheme").that.equals("nosec");

        // check property device_name
        expect(tdObj).to.have.property("properties").to.have.property("device_name");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("device_name")
            .to.have.property("type")
            .that.equals("string");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("device_name")
            .to.have.property("title")
            .that.equals("Device name");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("device_name")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);
        expect(tdObj.properties.device_name.forms[0]).to.have.property("op").to.eql("readproperty");
        expect(tdObj.properties.device_name.forms[0])
            .to.have.property("href")
            .to.eql("modbus+tcp://192.168.178.146:502/1/40020?quantity=16");
        expect(tdObj.properties.device_name.forms[0])
            .to.have.property("modbus:function")
            .to.eql("readHoldingRegisters");
        expect(tdObj.properties.device_name.forms[0]).to.have.property("modbus:type").to.eql("string");
        expect(tdObj.properties.device_name.forms[0])
            .to.have.property("contentType")
            .to.eql("application/octet-stream");
        expect(tdObj.properties.device_name.forms[0]).not.to.have.property("security");

        // check property soc
        expect(tdObj).to.have.property("properties").to.have.property("soc");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("soc")
            .to.have.property("type")
            .that.equals("integer");
        expect(tdObj).to.have.property("properties").to.have.property("soc").to.have.property("minimum").that.equals(0);
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("soc")
            .to.have.property("maximum")
            .that.equals(100);
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("soc")
            .to.have.property("title")
            .that.equals("Battery SoC scaled in %");
        expect(tdObj)
            .to.have.property("properties")
            .to.have.property("soc")
            .to.have.property("forms")
            .to.be.an("array")
            .to.have.lengthOf(1);
        expect(tdObj.properties.soc.forms[0]).to.have.property("op").to.eql("readproperty");
        expect(tdObj.properties.soc.forms[0])
            .to.have.property("href")
            .to.eql("modbus+tcp://192.168.178.146:502/40361?quantity=1");
        expect(tdObj.properties.soc.forms[0]).to.have.property("modbus:function").to.eql("readHoldingRegisters");
        expect(tdObj.properties.soc.forms[0]).to.have.property("modbus:type").to.eql("uint16be");
        expect(tdObj.properties.soc.forms[0]).to.have.property("contentType").to.eql("application/octet-stream");
        expect(tdObj.properties.device_name.forms[0]).not.to.have.property("security");
    }

    @test async "should correctly roundtrip inverterModbus from/to AID"() {
        const aasInput = (await fs.readFile("test/util/inverterModbus.json")).toString();
        const td = this.assetInterfaceDescriptionUtil.transformAAS2TD(aasInput);

        const aidOutput = this.assetInterfaceDescriptionUtil.transformTD2SM(td);

        const smObj = JSON.parse(aidOutput);
        expect(smObj).to.have.property("idShort").that.equals("AssetInterfacesDescription");
        expect(smObj).to.have.property("submodelElements").to.be.an("array").to.have.lengthOf.greaterThan(0);
        const smInterface = smObj.submodelElements[0];
        expect(smInterface).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
        let hasThingTitle = false;
        let hasEndpointMetadata = false;
        for (const smValue of smInterface.value) {
            if (smValue.idShort === "title") {
                hasThingTitle = true;
                expect(smValue).to.have.property("value").to.equal("Inverter GEN44");
            } else if (smValue.idShort === "EndpointMetadata") {
                hasEndpointMetadata = true;
                const endpointMetadata = smValue;
                expect(endpointMetadata).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
                let hasBase = false;
                let hasSecurity = false;
                let hasSecurityDefinitions = false;
                for (const endpointMetadataValue of endpointMetadata.value) {
                    if (endpointMetadataValue.idShort === "base") {
                        hasBase = true;
                        expect(endpointMetadataValue.value).to.equal("modbus+tcp://192.168.178.146:502/");
                    } else if (endpointMetadataValue.idShort === "security") {
                        hasSecurity = true;
                        expect(endpointMetadataValue)
                            .to.have.property("value")
                            .to.be.an("array")
                            .to.have.lengthOf.greaterThan(0);
                        expect(endpointMetadataValue.value[0].value).to.equal("nosec_sc");
                    } else if (endpointMetadataValue.idShort === "securityDefinitions") {
                        hasSecurityDefinitions = true;
                        expect(endpointMetadataValue)
                            .to.have.property("value")
                            .to.be.an("array")
                            .to.have.lengthOf.greaterThan(0);
                        let hasBasicSC = false;
                        for (const securityDefinitionValue of endpointMetadataValue.value) {
                            if (securityDefinitionValue.idShort === "nosec_sc") {
                                hasBasicSC = true;
                                expect(securityDefinitionValue)
                                    .to.have.property("value")
                                    .to.be.an("array")
                                    .to.have.lengthOf.greaterThan(0);
                                let hasBasic = false;
                                for (const sec of securityDefinitionValue.value) {
                                    if (sec.idShort === "scheme") {
                                        hasBasic = true;
                                        expect(sec.value).to.equal("nosec");
                                    }
                                }
                                expect(hasBasic).to.equal(true);
                            }
                        }
                        expect(hasBasicSC).to.equal(true);
                    }
                }
                expect(hasBase).to.equal(true);
                expect(hasSecurity).to.equal(true);
                expect(hasSecurityDefinitions).to.equal(true);
            }
        }
        expect(hasThingTitle, "No thing title").to.equal(true);
        expect(hasEndpointMetadata, "No EndpointMetadata").to.equal(true);

        // InterfaceMetadata with properties etc
        let hasInterfaceMetadata = false;
        for (const smValue of smInterface.value) {
            if (smValue.idShort === "InterfaceMetadata") {
                hasInterfaceMetadata = true;
                expect(smValue).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
                let hasProperties = false;
                for (const interactionValues of smValue.value) {
                    if (interactionValues.idShort === "properties") {
                        hasProperties = true;
                        expect(interactionValues)
                            .to.have.property("value")
                            .to.be.an("array")
                            .to.have.lengthOf.greaterThan(0);
                        let hasPropertyDeviceName = false;
                        let hasPropertySOC = false;
                        for (const propertyValue of interactionValues.value) {
                            if (propertyValue.idShort === "device_name") {
                                hasPropertyDeviceName = true;
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
                                        expect(propProperty.value).to.equal("Device name");
                                    } else if (propProperty.idShort === "observable") {
                                        hasObservable = true;
                                    } else if (propProperty.idShort === "forms") {
                                        hasForms = true;
                                        expect(propProperty)
                                            .to.have.property("value")
                                            .to.be.an("array")
                                            .to.have.lengthOf.greaterThan(0);
                                        let hasHref = false;
                                        let hasOp = false;
                                        let hasContentType = false;
                                        let hasModbusFunction = false;
                                        let hasModbusType = false;
                                        for (const formEntry of propProperty.value) {
                                            if (formEntry.idShort === "href") {
                                                hasHref = true;
                                                expect(formEntry.value).to.equal("1/40020?quantity=16");
                                            } else if (formEntry.idShort === "op") {
                                                hasOp = true;
                                                expect(formEntry.value).to.equal("readproperty");
                                            } else if (formEntry.idShort === "contentType") {
                                                hasContentType = true;
                                                expect(formEntry.value).to.equal("application/octet-stream");
                                            } else if (formEntry.idShort === "modbus_function") {
                                                // vs. "modbus:function"
                                                hasModbusFunction = true;
                                                expect(formEntry.value).to.equal("readHoldingRegisters");
                                            } else if (formEntry.idShort === "modbus_type") {
                                                // vs. "modbus:type"
                                                hasModbusType = true;
                                                expect(formEntry.value).to.equal("string");
                                            }
                                        }
                                        expect(hasHref).to.equal(true);
                                        expect(hasOp).to.equal(true);
                                        expect(hasContentType).to.equal(true);
                                        expect(hasModbusFunction).to.equal(true);
                                        expect(hasModbusType).to.equal(true);
                                    }
                                }
                                expect(hasType).to.equal(true);
                                expect(hasTitle).to.equal(true);
                                expect(hasObservable).to.equal(false); // it is default only
                                expect(hasForms).to.equal(true);
                            } else if (propertyValue.idShort === "soc") {
                                hasPropertySOC = true;
                                expect(propertyValue)
                                    .to.have.property("value")
                                    .to.be.an("array")
                                    .to.have.lengthOf.greaterThan(0);
                                let hasType = false;
                                let hasTitle = false;
                                let hasMinMax = false;
                                let hasForms = false;
                                for (const propProperty of propertyValue.value) {
                                    if (propProperty.idShort === "type") {
                                        hasType = true;
                                        expect(propProperty.value).to.equal("integer");
                                    } else if (propProperty.idShort === "title") {
                                        hasTitle = true;
                                        expect(propProperty.value).to.equal("Battery SoC scaled in %");
                                    } else if (propProperty.idShort === "min_max") {
                                        hasMinMax = true;
                                        expect(propProperty.min).to.equal("0");
                                        expect(propProperty.max).to.equal("100");
                                        expect(propProperty.valueType).to.equal("xs:integer");
                                        expect(propProperty.modelType).to.equal("Range");
                                    } else if (propProperty.idShort === "forms") {
                                        hasForms = true;
                                        expect(propProperty)
                                            .to.have.property("value")
                                            .to.be.an("array")
                                            .to.have.lengthOf.greaterThan(0);
                                        let hasHref = false;
                                        let hasOp = false;
                                        let hasContentType = false;
                                        let hasModbusFunction = false;
                                        let hasModbusType = false;
                                        for (const formEntry of propProperty.value) {
                                            if (formEntry.idShort === "href") {
                                                hasHref = true;
                                                expect(formEntry.value).to.equal("40361?quantity=1"); // use base
                                            } else if (formEntry.idShort === "op") {
                                                hasOp = true;
                                                expect(formEntry.value).to.equal("readproperty");
                                            } else if (formEntry.idShort === "contentType") {
                                                hasContentType = true;
                                                expect(formEntry.value).to.equal("application/octet-stream");
                                            } else if (formEntry.idShort === "modbus_function") {
                                                // vs. "modbus:function"
                                                hasModbusFunction = true;
                                                expect(formEntry.value).to.equal("readHoldingRegisters");
                                            } else if (formEntry.idShort === "modbus_type") {
                                                // vs. "modbus:type"
                                                hasModbusType = true;
                                                expect(formEntry.value).to.equal("uint16be");
                                            }
                                        }
                                        expect(hasHref).to.equal(true);
                                        expect(hasOp).to.equal(true);
                                        expect(hasContentType).to.equal(true);
                                        expect(hasModbusFunction).to.equal(true);
                                        expect(hasModbusType).to.equal(true);
                                    }
                                }
                                expect(hasType).to.equal(true);
                                expect(hasTitle).to.equal(true);
                                expect(hasMinMax).to.equal(true);
                                expect(hasForms).to.equal(true);
                            }
                        }
                        expect(hasPropertyDeviceName).to.equal(true);
                        expect(hasPropertySOC).to.equal(true);
                    }
                }
                expect(hasProperties).to.equal(true);
            }
        }
        expect(hasInterfaceMetadata, "No InterfaceMetadata").to.equal(true);
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
                descriptions: {
                    en: "Statistic",
                    de: "Statistik",
                },
                forms: [
                    {
                        href: "stat",
                        contentType: "application/json",
                        "htv:methodName": "GET",
                        op: ["readproperty"],
                    },
                ],
            },
            temperature: {
                description: "Temperature value of the weather station",
                type: "number",
                minimum: -32.5,
                maximum: 55.2,
                unit: "degreeCelsius",
                forms: [
                    {
                        href: "temp",
                    },
                ],
            },
        },
    };

    @test async "should correctly transform sample TD into AID submodel"() {
        const sm = this.assetInterfaceDescriptionUtil.transformTD2SM(JSON.stringify(this.td1), ["https"]);

        const smObj = JSON.parse(sm);
        expect(smObj).to.have.property("idShort").that.equals("AssetInterfacesDescription");
        expect(smObj).to.have.property("semanticId");
        expect(smObj).to.have.property("submodelElements").to.be.an("array").to.have.lengthOf.greaterThan(0);
        const smInterface = smObj.submodelElements[0];
        expect(smInterface).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
        expect(smInterface)
            .to.have.property("semanticId")
            .to.be.an("object")
            .with.property("keys")
            .to.be.an("array")
            .to.have.lengthOf.greaterThan(0);
        expect(smInterface)
            .to.have.property("supplementalSemanticIds")
            .to.be.an("array")
            .to.have.lengthOf.greaterThan(1); // default WoT-TD and http
        let hasThingTitle = false;
        let hasEndpointMetadata = false;
        for (const smValue of smInterface.value) {
            if (smValue.idShort === "title") {
                hasThingTitle = true;
                expect(smValue).to.have.property("value").to.equal("testTD");
            } else if (smValue.idShort === "EndpointMetadata") {
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
        expect(hasThingTitle, "No thing title").to.equal(true);
        expect(hasEndpointMetadata, "No EndpointMetadata").to.equal(true);

        // InterfaceMetadata with properties etc
        let hasInterfaceMetadata = false;
        for (const smValue of smInterface.value) {
            if (smValue.idShort === "InterfaceMetadata") {
                hasInterfaceMetadata = true;
                expect(smValue).to.have.property("value").to.be.an("array").to.have.lengthOf.greaterThan(0);
                let hasProperties = false;
                for (const interactionValues of smValue.value) {
                    if (interactionValues.idShort === "properties") {
                        hasProperties = true;
                        expect(interactionValues)
                            .to.have.property("value")
                            .to.be.an("array")
                            .to.have.lengthOf.greaterThan(0);
                        let hasPropertyStatus = false;
                        let hasPropertyTemperature = false;
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
                                let hasPropertyStatusDescription = false;
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
                                            } else if (formEntry.idShort === "htv_methodName") {
                                                hasHtvMethodName = true;
                                                expect(formEntry.value).to.equal("GET");
                                            }
                                        }
                                        expect(hasHref).to.equal(true);
                                        expect(hasContentType).to.equal(true);
                                        expect(hasHtvMethodName).to.equal(true);
                                    }
                                }
                                if (propertyValue.description != null) {
                                    hasPropertyStatusDescription = true;
                                    expect(propertyValue)
                                        .to.have.property("description")
                                        .to.eql([
                                            {
                                                language: "en",
                                                text: "Statistic",
                                            },
                                            {
                                                language: "de",
                                                text: "Statistik",
                                            },
                                        ]);
                                }
                                expect(hasType).to.equal(true);
                                expect(hasTitle).to.equal(false);
                                expect(hasObservable).to.equal(true);
                                expect(hasForms).to.equal(true);
                                expect(hasPropertyStatusDescription).to.equal(true);
                            } else if (propertyValue.idShort === "temperature") {
                                hasPropertyTemperature = true;
                                expect(propertyValue)
                                    .to.have.property("value")
                                    .to.be.an("array")
                                    .to.have.lengthOf.greaterThan(0);
                                let hasType = false;
                                let hasDescription = false;
                                let hasUnit = false;
                                let hasForms = false;
                                for (const propProperty of propertyValue.value) {
                                    if (propProperty.idShort === "type") {
                                        hasType = true;
                                        expect(propProperty.value).to.equal("number");
                                    } else if (propProperty.idShort === "description") {
                                        hasDescription = true;
                                        expect(propProperty.value).to.equal("Temperature value of the weather station");
                                    } else if (propProperty.idShort === "unit") {
                                        hasUnit = true;
                                        expect(propProperty.value).to.equal("degreeCelsius");
                                    } else if (propProperty.idShort === "forms") {
                                        hasForms = true;
                                    }
                                }
                                expect(hasType).to.equal(true);
                                expect(hasDescription).to.equal(true);
                                expect(hasUnit).to.equal(true);
                                expect(hasForms).to.equal(true);
                            }
                        }
                        expect(hasPropertyStatus).to.equal(true);
                        expect(hasPropertyTemperature).to.equal(true);
                    }
                }
                expect(hasProperties).to.equal(true);
            }
        }
        expect(hasInterfaceMetadata, "No InterfaceMetadata").to.equal(true);

        // Test to use all possible prefixes -> in this case it is only https
        const sm2 = this.assetInterfaceDescriptionUtil.transformTD2SM(JSON.stringify(this.td1));
        const sm2Obj = JSON.parse(sm2);
        // Note: id is autogenerated and needs to be exluded/removed
        delete smObj.id;
        delete sm2Obj.id;
        expect(smObj).to.eql(sm2Obj);
    }

    @test
    async "should transform sample TD into JSON submodel without any properties due to unknown protocol prefix"() {
        const sm = this.assetInterfaceDescriptionUtil.transformTD2SM(JSON.stringify(this.td1), ["unknown"]);

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
                    if (interactionValues.idShort === "properties") {
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

    @test.skip async "should correctly transform counter TD into JSON AAS"() {
        // built-in fetch requires Node.js 18+
        const response = await fetch("http://plugfest.thingweb.io:8083/counter");
        const counterTD = await response.json();

        const sm = this.assetInterfaceDescriptionUtil.transformTD2AAS(JSON.stringify(counterTD), ["http", "coap"]);

        const aasObj = JSON.parse(sm);
        // TODO proper AID submodel checks
        console.log("XXX\n\n");
        console.log(JSON.stringify(aasObj));
        console.log("\n\nXXX");

        expect(aasObj).to.have.property("assetAdministrationShells").to.be.an("array");
        expect(aasObj).to.have.property("submodels").to.be.an("array").to.have.lengthOf(1);
        const submodel = aasObj.submodels[0];
        expect(submodel).to.have.property("submodelElements").to.be.an("array").to.have.lengthOf(2);
    }
}

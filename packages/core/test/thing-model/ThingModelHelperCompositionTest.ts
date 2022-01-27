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
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { expect } from "chai";
import { ExposedThingInit } from "wot-typescript-definitions";

import ThingModelHelpers, { CompositionOptions, modelComposeInput } from "../../src/thing-model-helpers";
import Servient from "../../src/core";
import { HttpClientFactory } from "@node-wot/binding-http";
import { FileClientFactory } from "@node-wot/binding-file";

chai.use(chaiAsPromised);
@suite("tests to verify the composition feature of Thing Model Helper")
class ThingModelHelperCompositionTest {
    private srv: Servient;
    private thingModelHelpers: ThingModelHelpers;
    async before() {
        this.srv = new Servient();
        this.srv.addClientFactory(new HttpClientFactory());
        this.srv.addClientFactory(new FileClientFactory());
        this.thingModelHelpers = new ThingModelHelpers(this.srv);
        await this.srv.start();
    }

    @test async "should correctly compose a Thing Model with multiple partialTDs"() {
        // const modelJSON = await fs.readFile('test/thing-model/tmodels/SmartVentilator.tm.jsonld');
        // const finalJSON = await fs.readFile('test/thing-model/tmodels/SmartVentilator.td.jsonld');
        // const model = JSON.parse(modelJSON.toString()) as ExposedThingInit;
        // const finalModel = JSON.parse(finalJSON.toString()) as ExposedThingIni]t;
        const modelUri = "file://./test/thing-model/tmodels/SmartVentilator.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/SmartVentilator.td.jsonld";
        const finalModel = await this.thingModelHelpers.fetchModel(finalModelUri);
        const finalModelUri1 = "file://./test/thing-model/tmodels/Ventilator.td.jsonld";
        const finalModel1 = await this.thingModelHelpers.fetchModel(finalModelUri1);
        const finalModelUri2 = "file://./test/thing-model/tmodels/Led.td.jsonld";
        const finalModel2 = await this.thingModelHelpers.fetchModel(finalModelUri2);

        const modelInput = await this.thingModelHelpers.fetchAffordances(model);
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        const extendedModel = await this.thingModelHelpers.composeModel(model, modelInput, options);
        expect(extendedModel.length).to.be.equal(3);
        expect(extendedModel[0]).to.be.deep.equal(finalModel);
        expect(extendedModel[1]).to.be.deep.equal(finalModel1);
        expect(extendedModel[2]).to.be.deep.equal(finalModel2);
    }

    @test async "should correctly compose a Thing Model with multiple partialTDs and selfcomposition enabled"() {
        const modelUri = "file://./test/thing-model/tmodels/SmartVentilator.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/SmartVentilator.td.jsonld";
        const finalModel = await this.thingModelHelpers.fetchModel(finalModelUri);
        finalModel.links = [
            {
                rel: "type",
                href: "http://test.com/SmartVentilator.tm.jsonld",
                type: "application/tm+json",
            },
        ];
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: true,
        };
        const modelInput = await this.thingModelHelpers.fetchAffordances(model);
        const extendedModel = await this.thingModelHelpers.composeModel(model, modelInput, options);
        expect(extendedModel.length).to.be.equal(1);
        expect(extendedModel[0].links).to.be.deep.equal(finalModel.links);
    }

    @test async "should correctly compose a Thing Model with multiple partialTDs and extend/import"() {
        // const modelJSON = await fs.readFile('test/thing-model/tmodels/SmartVentilator.tm.jsonld');
        // const finalJSON = await fs.readFile('test/thing-model/tmodels/SmartVentilator.td.jsonld');
        // const model = JSON.parse(modelJSON.toString()) as ExposedThingInit;
        // const finalModel = JSON.parse(finalJSON.toString()) as ExposedThingIni]t;
        const modelUri = "file://./test/thing-model/tmodels/SmartVentilatorSubExtend.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/SmartVentilatorSubExtend.td.jsonld";
        const finalModel = await this.thingModelHelpers.fetchModel(finalModelUri);
        const finalModelUri1 = "file://./test/thing-model/tmodels/Ventilator.td.jsonld";
        const finalModel1 = await this.thingModelHelpers.fetchModel(finalModelUri1);
        const finalModelUri2 = "file://./test/thing-model/tmodels/LedExtend.td.jsonld";
        const finalModel2 = await this.thingModelHelpers.fetchModel(finalModelUri2);

        const modelInput = await this.thingModelHelpers.fetchAffordances(model);
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        const extendedModel = await this.thingModelHelpers.composeModel(model, modelInput, options);
        expect(extendedModel.length).to.be.equal(3);
        expect(extendedModel[0]).to.be.deep.equal(finalModel);
        expect(extendedModel[1]).to.be.deep.equal(finalModel1);
        expect(extendedModel[2]).to.be.deep.equal(finalModel2);
    }

    @test async "should correctly compose recursively a Thing Model with multiple partialTDs and extend/import"() {
        // const modelJSON = await fs.readFile('test/thing-model/tmodels/SmartVentilator.tm.jsonld');
        // const finalJSON = await fs.readFile('test/thing-model/tmodels/SmartVentilator.td.jsonld');
        // const model = JSON.parse(modelJSON.toString()) as ExposedThingInit;
        // const finalModel = JSON.parse(finalJSON.toString()) as ExposedThingIni]t;
        const modelUri = "file://./test/thing-model/tmodels/SmartVentilatorRecursive.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/SmartVentilatorRecursive.td.jsonld";
        const finalModel = await this.thingModelHelpers.fetchModel(finalModelUri);
        const finalModelUri1 = "file://./test/thing-model/tmodels/VentilatorRecursive.td.jsonld";
        const finalModel1 = await this.thingModelHelpers.fetchModel(finalModelUri1);
        const finalModelUri2 = "file://./test/thing-model/tmodels/LedExtend.td.jsonld";
        const finalModel2 = await this.thingModelHelpers.fetchModel(finalModelUri2);

        const modelInput = await this.thingModelHelpers.fetchAffordances(model);
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        finalModel2.links[0].href = "http://test.com/VentilatorThingModelRecursive.td.jsonld";
        const extendedModel = await this.thingModelHelpers.composeModel(model, modelInput, options);
        expect(extendedModel.length).to.be.equal(3);
        expect(extendedModel[0]).to.be.deep.equal(finalModel);
        expect(extendedModel[1]).to.be.deep.equal(finalModel1);
        expect(extendedModel[2]).to.be.deep.equal(finalModel2);
    }

    @test async "should correctly throw an error because of a self circular dependency"() {
        const modelUri = "file://./test/thing-model/tmodels/LedExtendLoop.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);

        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        await expect(this.thingModelHelpers.getPartialTDs(model, options)).be.rejectedWith(
            `Circular dependency found for ${modelUri}`
        );
    }

    @test async "should correctly throw an error because of a circular dependency"() {
        const modelUri = "file://./test/thing-model/tmodels/depsLoop/SmartLampControlImport.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);

        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        await expect(this.thingModelHelpers.getPartialTDs(model, options)).be.rejectedWith(
            `Circular dependency found for ${modelUri}`
        );
    }

    @test async "should correctly compose a model that does not have circular dependency"() {
        const modelUri = "file://./test/thing-model/tmodels/noDepsLoop/SmartLampControlImport.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/noDepsLoop/SmartLampControlImport.td.jsonld";
        const finalModel = await this.thingModelHelpers.fetchModel(finalModelUri);
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        const extendedModel = await this.thingModelHelpers.getPartialTDs(model, options);
        expect(extendedModel[0]).to.be.deep.equal(finalModel);
    }
}

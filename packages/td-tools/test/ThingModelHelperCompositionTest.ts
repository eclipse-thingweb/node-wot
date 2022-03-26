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
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { expect } from "chai";
import { promises as fsPromises } from 'fs';

import ThingModelHelpers, { CompositionOptions } from "../src/thing-model-helpers";
import { ExposedThingInit } from "wot-typescript-definitions";


chai.use(chaiAsPromised);
@suite("tests to verify the composition feature of Thing Model Helper")
class ThingModelHelperCompositionTest {
    private thingModelHelpers: ThingModelHelpers;
    async before() {
        this.thingModelHelpers = new ThingModelHelpers();
    }

    async fetch(uri: string): Promise<unknown> {
        const data = await fsPromises.readFile(uri, 'utf-8');
        return JSON.parse(data);
    }

    @test async "should correctly compose a Thing Model with multiple partialTDs"() {
        const modelUri = "file://./test/thing-model/tmodels/SmartVentilator.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/SmartVentilator.composed.tm.jsonld";
        const finalModel = await this.thingModelHelpers.fetchModel(finalModelUri);
        const finalModelUri1 = "file://./test/thing-model/tmodels/Ventilator.composed.tm.jsonld";
        const finalModel1 = await this.thingModelHelpers.fetchModel(finalModelUri1);
        const finalModelUri2 = "file://./test/thing-model/tmodels/Led.composed.tm.jsonld";
        const finalModel2 = await this.thingModelHelpers.fetchModel(finalModelUri2);

        // eslint-disable-next-line dot-notation
        const modelInput = await this.thingModelHelpers["fetchAffordances"](model);
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        // eslint-disable-next-line dot-notation
        const extendedModel = await this.thingModelHelpers["composeModel"](model, modelInput, options);
        expect(extendedModel.length).to.be.equal(3);
        expect(extendedModel[0]).to.be.deep.equal(finalModel);
        expect(extendedModel[1]).to.be.deep.equal(finalModel1);
        expect(extendedModel[2]).to.be.deep.equal(finalModel2);
    }

    @test async "should correctly compose a Thing Model with multiple partialTDs and selfcomposition enabled"() {
        const modelUri = "file://./test/thing-model/tmodels/SmartVentilator.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/SmartVentilator.composed.tm.jsonld";
        const finalModel = (await this.thingModelHelpers.fetchModel(finalModelUri)) as ExposedThingInit;
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
        // eslint-disable-next-line dot-notation
        const modelInput = await this.thingModelHelpers["fetchAffordances"](model);
        // eslint-disable-next-line dot-notation
        const extendedModel = await this.thingModelHelpers["composeModel"](model, modelInput, options);
        expect(extendedModel.length).to.be.equal(1);
        expect(extendedModel[0].links).to.be.deep.equal(finalModel.links);
    }

    @test async "should correctly compose a Thing Model with multiple partialTDs and extend/import"() {
        const modelUri = "file://./test/thing-model/tmodels/SmartVentilatorSubExtend.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/SmartVentilatorSubExtend.composed.tm.jsonld";
        const finalModel = await this.thingModelHelpers.fetchModel(finalModelUri);
        const finalModelUri1 = "file://./test/thing-model/tmodels/Ventilator.composed.tm.jsonld";
        const finalModel1 = await this.thingModelHelpers.fetchModel(finalModelUri1);
        const finalModelUri2 = "file://./test/thing-model/tmodels/LedExtend.composed.tm.jsonld";
        const finalModel2 = await this.thingModelHelpers.fetchModel(finalModelUri2);

        // eslint-disable-next-line dot-notation
        const modelInput = await this.thingModelHelpers["fetchAffordances"](model);
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        // eslint-disable-next-line dot-notation
        const extendedModel = await this.thingModelHelpers["composeModel"](model, modelInput, options);
        expect(extendedModel.length).to.be.equal(3);
        expect(extendedModel[0]).to.be.deep.equal(finalModel);
        expect(extendedModel[1]).to.be.deep.equal(finalModel1);
        expect(extendedModel[2]).to.be.deep.equal(finalModel2);
    }

    @test async "should correctly compose recursively a Thing Model with multiple partialTDs and extend/import"() {
        const modelUri = "file://./test/thing-model/tmodels/SmartVentilatorRecursive.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);
        const finalModelUri = "file://./test/thing-model/tmodels/SmartVentilatorRecursive.composed.tm.jsonld";
        const finalModel = await this.thingModelHelpers.fetchModel(finalModelUri);
        const finalModelUri1 = "file://./test/thing-model/tmodels/VentilatorRecursive.composed.tm.jsonld";
        const finalModel1 = await this.thingModelHelpers.fetchModel(finalModelUri1);
        const finalModelUri2 = "file://./test/thing-model/tmodels/LedExtend.composed.tm.jsonld";
        const finalModel2 = (await this.thingModelHelpers.fetchModel(finalModelUri2)) as ExposedThingInit;

        // eslint-disable-next-line dot-notation
        const modelInput = await this.thingModelHelpers["fetchAffordances"](model);
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        finalModel2.links[0].href = "http://test.com/VentilatorThingModelRecursive.td.jsonld";
        // eslint-disable-next-line dot-notation
        const extendedModel = await this.thingModelHelpers["composeModel"](model, modelInput, options);
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
        const finalModelUri = "./test/thing-model/tmodels/noDepsLoop/SmartLampControlImport.td.jsonld";
        const finalModel = await this.fetch(finalModelUri);
        const options: CompositionOptions = {
            baseUrl: "http://test.com",
            selfComposition: false,
        };
        const extendedModel = await this.thingModelHelpers.getPartialTDs(model, options);
        expect(extendedModel[0]).to.be.deep.equal(finalModel);
    }
}

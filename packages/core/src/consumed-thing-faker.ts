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

import * as WoT from "wot-typescript-definitions";

import fake, { JsonSchema } from "typescript-json-schema-faker";

/**
 * The ConsumedThingFaker class is meant to generate data that matches the JSON schema definitions.
 * Note: IF a schema is fixed/set (e.g., by using single entries in enums) it generates given data always.
 * 
 * https://json-schema-faker.js.org/ 
 */
export default class ConsumedThingFaker {

    // backed ConsumedThing
    ct: WoT.ConsumedThing ;

    constructor(ct: WoT.ConsumedThing) {
        this.ct = ct;
    }

    // readProperty(propertyName: string): Promise<any> {
    //     return new Promise<any>((resolve, reject) => {
    //         // resolve("value");
    //         reject(new Error(`Not implemented`));
    //     });
    // }

    // writeProperty(propertyName: string, value: any): Promise<void> {
    //     return new Promise<void>((resolve, reject) => {
    //         reject(new Error(`Not implemented`));
    //     });
    // }

    public invokeAction(actionName: string, parameter?: any): Promise<any> {
        // fake data based on input JSON schema

        console.log("YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY");
        console.log(JSON.stringify(this.ct.actions[actionName].input));
        
        const schema: JsonSchema = JSON.parse(JSON.stringify(this.ct.actions[actionName].input));

        // const schema: JsonSchema = {
        //     id: "someSchemaId",
        //     type: "string"
        // };

        console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
        let fakeInput = fake(schema); 
        console.log(fakeInput);

        return this.ct.actions[actionName].invoke(fakeInput);
    }


} 
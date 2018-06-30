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


import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

import { ResourceListener, BasicResourceListener, Content, ContentSerdes } from "@node-wot/core";

//import MQTTServer from "../src/http-server";
import MqttClient from "../src/mqtt-client";

class TestResourceListener extends BasicResourceListener implements ResourceListener {

    public referencedVector: any;
    constructor(vector: any) {
        super();
        this.referencedVector = vector;
    }


/*
    public subscribeResource(form: MQTTForm, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): Subscription {

        let active = true;
        let polling = () => {
          let req = this.generateRequest(form, "GET");
          let info = <any>req;
          
          // long timeout for long polling
          req.setTimeout(60*60*1000);
    
          console.log(`HttpClient sending ${info.method} to ${form.href}`);
      
          req.on("response", (res: https.IncomingMessage) => {
            console.log(`HttpClient received ${res.statusCode} from ${form.href}`);
            let mediaType: string = this.getContentType(res);
            let body: Array<any> = [];
            res.on("data", (data) => { body.push(data) });
            res.on("end", () => {
              if (active) {
                next({ mediaType: mediaType, body: Buffer.concat(body) });
                polling();
              }
            });
          });
          req.on("error", (err: any) => error(err));
    
          req.flushHeaders();
          req.end();
        };
    
        polling();
    
        return new Subscription( () => { active = false; } );*/
      }
      

@suite("MQTT client subscribe implementation")
class MqttClientSubscribeTest {

    @test async "should apply form information"() {
 /*
    try {

       
        var testVector = { expect: "UNSET" }

        let httpServer = new HttpServer(60603);
        httpServer.addResource("/", new TestResourceListener(testVector) );

        await httpServer.start();
        expect(httpServer.getPort()).to.equal(60603);

        let client = new HttpClient();
        let representation;

        // read with POST instead of GET
        representation = await client.readResource({
            href: "http://localhost:60603/",
            "http:methodName": "POST"
        });
        expect(testVector.expect).to.equal("POST");
        testVector.expect = "UNSET";

        // write with POST instead of PUT
        representation = await client.writeResource({
            href: "http://localhost:60603/",
            "http:methodName": "POST"
        }, { mediaType: ContentSerdes.DEFAULT, body: new Buffer("test") } );
        expect(testVector.expect).to.equal("POST");
        testVector.expect = "UNSET";

        // invoke with PUT instead of POST
        representation = await client.invokeResource({
            href: "http://localhost:60603/",
            "http:methodName": "PUT"
        }, { mediaType: ContentSerdes.DEFAULT, body: new Buffer("test") } );
        expect(testVector.expect).to.equal("PUT");
        testVector.expect = "UNSET";

        // invoke with DELETE instead of POST
        representation = await client.invokeResource({
            href: "http://localhost:60603/",
            "http:methodName": "DELETE"
        });
        expect(testVector.expect).to.equal("DELETE");
        testVector.expect = "UNSET";
        
        // FIXME -- why does it block forever?
        //await httpServer.stop();

    } catch (err) {
        console.error("ERROR", err);
    }*/
    }
    
}

/********************************************************************************
 * Copyright (c) 2018 - 2020 Contributors to the Eclipse Foundation
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
import fetch, { Request } from "node-fetch";
import { BasicCredential } from "./credential";
import * as http from "http";
import {Agent as SecureAgent} from "https"

export interface Method {
    name: string
}

export interface IntrospectionEndpoint extends Method {
    endpoint:string;
    allowSelfSigned?:boolean;

    credentials?: {username:string, password:string}
}
/**
 * Identify an introspection result. It contains some of the 
 * properties defined in 
 * https://tools.ietf.org/html/rfc7662#section-2.2
 */
interface TokenInformation {
    /**
     * Boolean indicator of whether or not the presented token
     * is currently active.
     */
    active: boolean
    /**
     * A JSON string containing a space-separated list of
     * scopes associated with this token
     */
    scope?: string
    /**
     * Client identifier for the OAuth 2.0 client that 
     * requested this token
     */
    client_id?:string
    
}

export default function (method?:Method) {
    if(!method || !method?.name){
        throw new Error("Undefined oauth token validation method")
    } 

    switch (method.name) {
        case "introspection_endpoint":
            return new EndpointValidator(method as IntrospectionEndpoint)
        default:
            throw new Error("Unsupported oauth token validation method " + method.name)
    }

}

export abstract class Validator{
    abstract validate(tokenRequest: http.IncomingMessage, scopes: Array<string>, clients: RegExp):Promise<boolean>
}

export class EndpointValidator extends Validator{
    private config: IntrospectionEndpoint;
    private agent: http.Agent
    constructor(config:IntrospectionEndpoint) {
        super();
        this.config = config
        let endpoint = config.endpoint
        this.agent = endpoint.startsWith("https") ? new SecureAgent({
            rejectUnauthorized: !config.allowSelfSigned
        }) : new http.Agent();
    }
    async validate(tokenRequest: http.IncomingMessage,scopes:Array<string>,clients:RegExp): Promise<boolean> {
        const token = extractTokenFromRequest(tokenRequest)
        const request = new Request(this.config.endpoint,{
            method: "POST",
            body:`token=${token}`,
            headers:{
                "content-type":"application/x-www-form-urlencoded"
            },
            agent: this.agent
        });
        
        if(this.config.credentials){
            await new BasicCredential(this.config.credentials).sign(request)
        }
        
        const response = await fetch(request);
        
        if(response.status != 200){
            throw new Error("Introspection endpoint error: "+response.statusText);
        }
        
        let contentType = response.headers.get("content-type")
        contentType = response.headers.get("content-type")?.split(";")[0]

        if(contentType !== "application/json"){
            throw new Error("Introspection response is not a json file. Content-Type: " + response.headers.get("content-type"));
        }

        const validationResult = await response.json() as TokenInformation

        if(validationResult.active === undefined){
            throw new Error("Malformed token introspection response: active is undefined");
            
        }
        // Endpoint validation
        if(!validationResult.active){
            return false
        }

        // Check if the token's scopes are allowed by the Thing Descriptor
        if(validationResult.scope){
            const tokenScopes = validationResult.scope.split(" ")
            const validScope = tokenScopes.some(tokenScope => {
                return scopes.some(thingScope => tokenScope === thingScope)
            })

            if(!validScope) return false;
        }

        // Check if the client was allowed in the servient configuration file
        if(validationResult.client_id && !validationResult.client_id.match(clients)){
            return false
        }

        return true;

    }

}

function extractTokenFromRequest(request: http.IncomingMessage) {
    const headerToken = request.headers.authorization;
    const url = new URL(request.url, `http://${request.headers.host}`)
    const queryToken = url.searchParams.get("access_token")

    if(!headerToken && !queryToken ){
        throw new Error("Invalid request: only one authentication method is allowed");
    }

    if(queryToken){
        return queryToken
    }
   
    var matches = headerToken.match(/Bearer\s(\S+)/);

    if (!matches) {
        throw new Error('Invalid request: malformed authorization header');
    }

    return matches[1];

}
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

import { APIKeySecurityScheme } from "@node-wot/td-tools";
import { Token, CredentialsFlow } from "client-oauth2";
import { Request} from 'node-fetch';


export abstract class Credential{
    abstract async sign(request:Request):Promise<Request>
}

export class BasicCredential extends Credential{
    private readonly username: string;
    private readonly password: string;
    /**
     *
     */
    constructor({ username, password }: { username: string; password: string; }) {
        super();
        if (username === undefined || password === undefined || 
                username === null || password === null) {
            throw new Error(`No Basic credentials for Thing`);
        }

        this.username = username;
        this.password = password;
    }
    async sign(request:Request){
        let result = request.clone()
        result.headers.set("authorization","Basic "+Buffer.from(this.username + ":" + this.password).toString('base64'))
        return result
    }
}

export class BearerCredential extends Credential{
    private readonly token: string;
    constructor(token:string){
        super();
        if (token === undefined || token === null) {
            throw new Error(`No Bearer credentionals for Thing`);
        }

        this.token = token;
    }
    async sign(request: Request) {
        let result = request.clone()
        result.headers.set("authorization", "Bearer " + this.token)
        return result
    }
}

export class BasicKeyCredential extends Credential{
    private readonly apiKey: string;
    private readonly options: APIKeySecurityScheme;
    
    constructor(apiKey:string,options:APIKeySecurityScheme){
        super();
        if (apiKey === undefined || apiKey === null) {
            throw new Error(`No API key credentials for Thing`);
        }

        this.apiKey= apiKey;
        this.options = options;
    }
    async sign(request: Request) {
        const result = request.clone()
        
        let headerName = "authorization"
        if (this.options.in === "header" && this.options.name !== undefined) {
            headerName = this.options.name;
        }
        result.headers.append(headerName, this.apiKey)
        
        return result
    }
}



export class OAuthCredential extends Credential {
    private token: Token | Promise<Token> ;
    private readonly refresh: () => Promise<Token> ;
   
    /**
     * 
     * @param tokenRequest oAuth2 token instance
     * @param refresh use a custom refresh function
     */
    constructor(token: Token | Promise<Token>,refresh?:() => Promise<Token>) {
        super();
        this.token = token;
        this.refresh = refresh;
        this.token = token
    }
    async sign(request: Request) {
        if (this.token instanceof Promise){
            const tokenRequest = this.token as Promise<Token>
            this.token = await tokenRequest
        }
       
        let tempRequest = {url:request.url,headers:{}}
        
        tempRequest = this.token.sign(tempRequest)
        
        const mergeHeaders = new Request(request,tempRequest)
        const useNewURL = new Request(tempRequest.url,mergeHeaders)
        
        return useNewURL
    }

    async refreshToken() {
        if(this.token instanceof Promise){
            throw new Error("Uninitialized token. You have to call sing before refresh");
        }

        let newToken 
        if (this.refresh){
            newToken = await this.refresh()
        }else{
            newToken = await this.token.refresh()
        }
        return new OAuthCredential(newToken,this.refresh)
    }
}
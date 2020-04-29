import { OAuth2SecurityScheme } from '@node-wot/td-tools';
import * as ClientOAuth2 from "client-oauth2";
import { request,RequestOptions } from 'https';
import { OutgoingHttpHeaders } from 'http';
import { parse } from 'url';
import { Buffer } from 'buffer';
import { OAuthCredential } from './credential';

function createRequestFunction(rejectUnauthorized:boolean) {
    //TODO: Does not work inside a browser
    return (method: string, url: string, body: string, headers: { [key: string]: string | string[] }): Promise<{ status: number, body: string }> => {
        return new Promise((resolve, reject) => {
            let parsedURL = parse(url)

            const options: RequestOptions = {
                method: method,
                host: parsedURL.hostname,
                port: parseInt(parsedURL.port),
                path: parsedURL.path,
                headers: headers
            }

            options.rejectUnauthorized = rejectUnauthorized;
            const req = request(options);

            req.on("response", (response) => {
                response.setEncoding('utf8');
                let body: Array<any> = [];
                response.on('data', (data) => { body.push(data) });
                response.on('end', () => {
                    resolve({
                        status: response.statusCode,
                        body: body.toString()
                    })
                });
            })
            req.on("error", (er) => {
                reject(er)
            })

            req.write(body)

            req.end()
        })
    }
}
export default class OAuthManager{
    private tokenStore:Map<string,ClientOAuth2.Token> = new Map()
    constructor() {}
    async handleClientCredential(securityScheme:OAuth2SecurityScheme,credentials:any):Promise<OAuthCredential>{ 
        
        const clientFlow: ClientOAuth2 = new ClientOAuth2({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            accessTokenUri: securityScheme.token,
            scopes: securityScheme.scopes,
            body: {
                // TODO: some server implementation may require client_id and secret inside
                // the request body

                // client_id: credentials.clientId,
                //  client_secret: credentials.clientSecret
            }
        },createRequestFunction(false))
        const token = await clientFlow.credentials.getToken()
        return new OAuthCredential(token,clientFlow.credentials.getToken.bind(clientFlow.credentials))
    }

    async handleResourceOwnerCredential(securityScheme: OAuth2SecurityScheme, credentials: any):Promise<OAuthCredential>{ 
        const clientFlow: ClientOAuth2 = new ClientOAuth2({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            accessTokenUri: securityScheme.token,
            scopes: securityScheme.scopes,
        },createRequestFunction(false))
        const token = await clientFlow.owner.getToken(credentials.username, credentials.password)

        return new OAuthCredential(token)
    }
    
    async refreshToken(token:string){
        const storedToken = this.tokenStore.get(token)
        
        if(!storedToken){
            throw new Error("Token not found");
        }

        return storedToken.refresh()
    }
}
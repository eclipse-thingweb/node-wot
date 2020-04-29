import { APIKeySecurityScheme } from "@node-wot/td-tools";
import { Token, CredentialsFlow } from "client-oauth2";
import { Request} from 'node-fetch';


export abstract class Credential{
    abstract sign(request:Request):Request
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
    sign(request:Request){
        let result = request.clone()
        result.headers.set("authorization",Buffer.from(this.username + ":" + this.password).toString('base64'))
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
    sign(request: Request) {
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
    sign(request: Request) {
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
    private readonly token: Token;
    private readonly refresh: () => Promise<Token> ;
   
    /**
     * 
     * @param token oAuth2 token instance
     * @param refresh use a custom refresh function
     */
    constructor(token:Token,refresh?:() => Promise<Token>) {
        super();
        this.token = token;
        this.refresh = refresh;
    }
    sign(request: Request) {
        let tempRequest = {url:request.url,headers:{}}
        
        tempRequest = this.token.sign(tempRequest)
        
        const mergeHeaders = new Request(request,tempRequest)
        const useNewURL = new Request(tempRequest.url,mergeHeaders)
        
        return useNewURL
    }

    async refreshToken() {
        let newToken 
        if (this.refresh){
            newToken = await this.refresh()
        }else{
            newToken = await this.token.refresh()
        }
        return new OAuthCredential(newToken,this.refresh)
    }
}

export default class InMemoryModel{
    clients: { clientId: string; clientSecret: string; redirectUris: string[];grants:string[] }[];
    tokens: any[];
    users: { id: string; username: string; password: string; }[];
    /**
     *
     */
    constructor() {
        this.clients = [{ clientId: 'thom', clientSecret: 'nightworld', redirectUris: [''], grants: ["client_credentials", "password","refresh_token"] }];
        this.tokens = [];
        this.users = [{ id: '123', username: 'thomseddon', password: 'nightworld' }];
        
    }

    dump() {
        console.log('clients', this.clients);
        console.log('tokens', this.tokens);
        console.log('users', this.users);
    }

    /*
     * Get access token.
     */

    getAccessToken  (bearerToken:string) {
        var tokens = this.tokens.filter(function (token) {
            return token.accessToken === bearerToken;
        });

        return tokens.length ? tokens[0] : false;
    }

    /**
     * Get refresh token.
     */

    getRefreshToken  (bearerToken:string) {
        var tokens = this.tokens.filter(function (token) {
            return token.refreshToken === bearerToken;
        });

        return tokens.length ? tokens[0] : false;
    };

    /**
     * Get client.
     */

    getClient  (clientId:string, clientSecret:string) {
        var clients = this.clients.filter(function (client) {
            return client.clientId === clientId && (!clientSecret || client.clientSecret === clientSecret);
        });

        return clients.length ? clients[0] : false;
    };

    /**
     * Save token.
     */

    saveToken  (token:any, client:any, user:any) {
        let { accessToken, accessTokenExpiresAt, refreshTokenExpiresAt, refreshToken} = token;
        this.tokens.push({
            accessToken: accessToken,
            accessTokenExpiresAt: accessTokenExpiresAt,
            client: client,
            refreshToken: refreshToken,
            refreshTokenExpiresAt: refreshTokenExpiresAt,
            user: user
        });
        return this.tokens[this.tokens.length -1 ]
    };

    /*
     * Get user.
     */

    getUser  (username:string, password:string) {
        var users = this.users.filter(function (user) {
            return user.username === username && user.password === password;
        });

        return users.length ? users[0] : false;
    };

    getUserFromClient(client:string){
        return this.users[0]
    }

    saveAuthorizationCode(){

    }

    revokeToken(token:any):boolean{
        return true;
    }

    expireAllTokens(){
        for (const token of this.tokens) {
            token.accessTokenExpiresAt = Date.now()
        }
    }

}
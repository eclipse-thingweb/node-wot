
module.exports =  class InMemoryModel{
    /**
     *
     */
    constructor() {
        this.clients = [{ clientId: 'node-wot', clientSecret: 'isgreat!', redirectUris: [''], grants:["client_credentials","password"] }];
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

    getAccessToken  (bearerToken) {
        var tokens = this.tokens.filter(function (token) {
            return token.accessToken === bearerToken;
        });

        return tokens.length ? tokens[0] : false;
    }

    /**
     * Get refresh token.
     */

    getRefreshToken  (bearerToken) {
        var tokens = this.tokens.filter(function (token) {
            return token.refreshToken === bearerToken;
        });

        return tokens.length ? tokens[0] : false;
    };

    /**
     * Get client.
     */

    getClient  (clientId, clientSecret) {
        var clients = this.clients.filter(function (client) {
            return client.clientId === clientId && (!clientSecret || client.clientSecret === clientSecret);
        });

        return clients.length ? clients[0] : false;
    };

    /**
     * Save token.
     */

    saveToken  (token, client, user) {
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

    getUser  (username, password) {
        var users = this.users.filter(function (user) {
            return user.username === username && user.password === password;
        })

        return users.length ? users[0] : false;
    };

    getUserFromClient(client){
        return this.users[0]
    }

    saveAuthorizationCode(){

    }

    expireAllTokens(){
        for (const token of this.tokens) {
            token.accessTokenExpiresAt = Date.now()
        }
    }

}
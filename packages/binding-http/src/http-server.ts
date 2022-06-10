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

/**
 * HTTP Server based on http
 */

import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import bauth from "basic-auth";
import * as url from "url";

import { AddressInfo } from "net";

import * as TD from "@node-wot/td-tools";
import Servient, {
    ProtocolServer,
    ContentSerdes,
    Helpers,
    ExposedThing,
    ProtocolHelpers,
    PropertyContentMap,
    Content,
} from "@node-wot/core";
import { HttpConfig, HttpForm, OAuth2ServerConfig } from "./http";
import createValidator, { Validator } from "./oauth-token-validation";
import { OAuth2SecurityScheme } from "@node-wot/td-tools";
import slugify from "slugify";
import { ThingDescription } from "wot-typescript-definitions";
import * as acceptLanguageParser from "accept-language-parser";
import { PropertyElement } from "wot-thing-description-types";

export default class HttpServer implements ProtocolServer {
    public readonly scheme: "http" | "https";

    private readonly PROPERTY_DIR = "properties";
    private readonly ACTION_DIR = "actions";
    private readonly EVENT_DIR = "events";

    private readonly OBSERVABLE_DIR = "observable";

    // private readonly OPTIONS_URI_VARIABLES ='uriVariables';
    // private readonly OPTIONS_BODY_VARIABLES ='body';

    private readonly port: number = 8080;
    private readonly address: string = undefined;
    private readonly baseUri: string = undefined;
    private readonly httpSecurityScheme: string = "NoSec"; // HTTP header compatible string
    private readonly validOAuthClients: RegExp = /.*/g;
    private readonly server: http.Server | https.Server = null;
    private readonly things: Map<string, ExposedThing> = new Map<string, ExposedThing>();
    private servient: Servient = null;
    private oAuthValidator: Validator;

    constructor(config: HttpConfig = {}) {
        if (typeof config !== "object") {
            throw new Error(`HttpServer requires config object (got ${typeof config})`);
        }

        if (config.port !== undefined) {
            this.port = config.port;
        }

        const environmentObj = ["WOT_PORT", "PORT"]
            .map((envVar) => {
                return { key: envVar, value: process.env[envVar] };
            })
            .find((envObj) => envObj.value != null);

        if (environmentObj) {
            console.info(
                "[binding-http]",
                `HttpServer Port Overridden to ${environmentObj.value} by Environment Variable ${environmentObj.key}`
            );
            this.port = +environmentObj.value;
        }

        if (config.address !== undefined) {
            this.address = config.address;
        }
        if (config.baseUri !== undefined) {
            this.baseUri = config.baseUri;
        }

        // TLS
        if (config.serverKey && config.serverCert) {
            const options: https.ServerOptions = {};
            options.key = fs.readFileSync(config.serverKey);
            options.cert = fs.readFileSync(config.serverCert);
            this.scheme = "https";
            this.server = https.createServer(options, (req, res) => {
                this.handleRequest(req, res);
            });
        } else {
            this.scheme = "http";
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });
        }

        // Auth
        if (config.security) {
            // storing HTTP header compatible string
            switch (config.security.scheme) {
                case "nosec":
                    this.httpSecurityScheme = "NoSec";
                    break;
                case "basic":
                    this.httpSecurityScheme = "Basic";
                    break;
                case "digest":
                    this.httpSecurityScheme = "Digest";
                    break;
                case "bearer":
                    this.httpSecurityScheme = "Bearer";
                    break;
                case "oauth2":
                    {
                        this.httpSecurityScheme = "OAuth";
                        const oAuthConfig = config.security as OAuth2ServerConfig;
                        this.validOAuthClients = new RegExp(oAuthConfig.allowedClients ?? ".*");
                        this.oAuthValidator = createValidator(oAuthConfig.method);
                    }
                    break;
                default:
                    throw new Error(`HttpServer does not support security scheme '${config.security.scheme}`);
            }
        }
    }

    public start(servient: Servient): Promise<void> {
        console.info(
            "[binding-http]",
            `HttpServer starting on ${this.address !== undefined ? this.address + " " : ""}port ${this.port}`
        );
        return new Promise<void>((resolve, reject) => {
            // store servient to get credentials
            this.servient = servient;

            // long timeout for long polling
            this.server.setTimeout(60 * 60 * 1000, () => {
                console.debug("[binding-http]", `HttpServer on port ${this.getPort()} timed out connection`);
            });
            // no keep-alive because NodeJS HTTP clients do not properly use same socket due to pooling
            this.server.keepAliveTimeout = 0;

            // start promise handles all errors until successful start
            this.server.once("error", (err: Error) => {
                reject(err);
            });
            this.server.once("listening", () => {
                // once started, console "handles" errors
                this.server.on("error", (err: Error) => {
                    console.error("[binding-http]", `HttpServer on port ${this.port} failed: ${err.message}`);
                });
                resolve();
            });
            this.server.listen(this.port, this.address);
        });
    }

    public stop(): Promise<void> {
        console.info("[binding-http]", `HttpServer stopping on port ${this.getPort()}`);
        return new Promise<void>((resolve, reject) => {
            // stop promise handles all errors from now on
            this.server.once("error", (err: Error) => {
                reject(err);
            });
            this.server.once("close", () => {
                resolve();
            });
            this.server.close();
        });
    }

    /** returns http.Server to be re-used by other HTTP-based bindings (e.g., WebSockets) */
    public getServer(): http.Server | https.Server {
        return this.server;
    }

    /** returns server port number and indicates that server is running when larger than -1  */
    public getPort(): number {
        if (this.server.address() && typeof this.server.address() === "object") {
            return (<AddressInfo>this.server.address()).port;
        } else {
            // includes address() typeof "string" case, which is only for unix sockets
            return -1;
        }
    }

    public getHttpSecurityScheme(): string {
        return this.httpSecurityScheme;
    }

    private updateInteractionNameWithUriVariablePattern(
        interactionName: string,
        uriVariables: PropertyElement["uriVariables"]
    ): string {
        if (uriVariables && Object.keys(uriVariables).length > 0) {
            let pattern = "{?";
            let index = 0;
            for (const key in uriVariables) {
                if (index !== 0) {
                    pattern += ",";
                }
                pattern += encodeURIComponent(key);
                index++;
            }
            pattern += "}";
            return encodeURIComponent(interactionName) + pattern;
        } else {
            return encodeURIComponent(interactionName);
        }
    }

    public async expose(thing: ExposedThing, tdTemplate?: WoT.ExposedThingInit): Promise<void> {
        let urlPath = slugify(thing.title, { lower: true });

        if (this.things.has(urlPath)) {
            urlPath = Helpers.generateUniqueName(urlPath);
        }

        if (this.getPort() !== -1) {
            console.debug(
                "[binding-http]",
                `HttpServer on port ${this.getPort()} exposes '${thing.title}' as unique '/${urlPath}'`
            );
            this.things.set(urlPath, thing);

            if (this.baseUri !== undefined) {
                const base: string = this.baseUri.concat("/", encodeURIComponent(urlPath));
                console.info("[binding-http]", "HttpServer TD hrefs using baseUri " + this.baseUri);
                this.addEndpoint(thing, tdTemplate, base);
            } else {
                // fill in binding data
                for (const address of Helpers.getAddresses()) {
                    const base: string =
                        this.scheme + "://" + address + ":" + this.getPort() + "/" + encodeURIComponent(urlPath);

                    this.addEndpoint(thing, tdTemplate, base);
                    // media types
                } // addresses

                if (this.scheme === "https") {
                    this.fillSecurityScheme(thing);
                }
            }
        }
    }

    public destroy(thingId: string): Promise<boolean> {
        console.debug("[binding-http]", `HttpServer on port ${this.getPort()} destroying thingId '${thingId}'`);
        return new Promise<boolean>((resolve, reject) => {
            let removedThing: ExposedThing;
            for (const name of Array.from(this.things.keys())) {
                const expThing = this.things.get(name);
                if (expThing?.id === thingId) {
                    this.things.delete(name);
                    removedThing = expThing;
                }
            }
            if (removedThing) {
                console.info("[binding-http]", `HttpServer succesfully destroyed '${removedThing.title}'`);
            } else {
                console.info("[binding-http]", `HttpServer failed to destroy thing with thingId '${thingId}'`);
            }
            resolve(removedThing !== undefined);
        });
    }

    public addEndpoint(thing: ExposedThing, tdTemplate: WoT.ExposedThingInit, base: string): void {
        for (const type of ContentSerdes.get().getOfferedMediaTypes()) {
            let allReadOnly = true;
            let allWriteOnly = true;
            let anyProperties = false;
            for (const propertyName in thing.properties) {
                anyProperties = true;
                if (!thing.properties[propertyName].readOnly) {
                    allReadOnly = false;
                } else if (!thing.properties[propertyName].writeOnly) {
                    allWriteOnly = false;
                }
            }
            if (anyProperties) {
                const href = base + "/" + this.PROPERTY_DIR;
                const form = new TD.Form(href, type);
                if (allReadOnly) {
                    form.op = ["readallproperties", "readmultipleproperties"];
                } else if (allWriteOnly) {
                    form.op = ["writeallproperties", "writemultipleproperties"];
                } else {
                    form.op = [
                        "readallproperties",
                        "readmultipleproperties",
                        "writeallproperties",
                        "writemultipleproperties",
                    ];
                }
                if (!thing.forms) {
                    thing.forms = [];
                }
                thing.forms.push(form);
            }

            for (const propertyName in thing.properties) {
                const propertyNamePattern = this.updateInteractionNameWithUriVariablePattern(
                    propertyName,
                    thing.properties[propertyName].uriVariables
                );
                const href = base + "/" + this.PROPERTY_DIR + "/" + propertyNamePattern;
                const form = new TD.Form(href, type);
                ProtocolHelpers.updatePropertyFormWithTemplate(form, thing.properties[propertyName]);
                if (thing.properties[propertyName].readOnly) {
                    form.op = ["readproperty"];
                    const hform: HttpForm = form;
                    if (hform["htv:methodName"] === undefined) {
                        hform["htv:methodName"] = "GET";
                    }
                } else if (thing.properties[propertyName].writeOnly) {
                    form.op = ["writeproperty"];
                    const hform: HttpForm = form;
                    if (hform["htv:methodName"] === undefined) {
                        hform["htv:methodName"] = "PUT";
                    }
                } else {
                    form.op = ["readproperty", "writeproperty"];
                }

                thing.properties[propertyName].forms.push(form);
                console.debug(
                    "[binding-http]",
                    `HttpServer on port ${this.getPort()} assigns '${href}' to Property '${propertyName}'`
                );

                // if property is observable add an additional form with a observable href
                if (thing.properties[propertyName].observable) {
                    const href =
                        base +
                        "/" +
                        this.PROPERTY_DIR +
                        "/" +
                        encodeURIComponent(propertyName) +
                        "/" +
                        this.OBSERVABLE_DIR;
                    const form = new TD.Form(href, type);
                    form.op = ["observeproperty", "unobserveproperty"];
                    form.subprotocol = "longpoll";
                    thing.properties[propertyName].forms.push(form);
                    console.debug(
                        "[binding-http]",
                        `HttpServer on port ${this.getPort()} assigns '${href}' to observable Property '${propertyName}'`
                    );
                }
            }

            for (const actionName in thing.actions) {
                const actionNamePattern = this.updateInteractionNameWithUriVariablePattern(
                    actionName,
                    thing.actions[actionName].uriVariables
                );
                const href = base + "/" + this.ACTION_DIR + "/" + actionNamePattern;
                const form = new TD.Form(href, type);
                ProtocolHelpers.updateActionFormWithTemplate(form, thing.actions[actionName]);
                form.op = ["invokeaction"];
                const hform: HttpForm = form;
                if (hform["htv:methodName"] === undefined) {
                    hform["htv:methodName"] = "POST";
                }
                thing.actions[actionName].forms.push(form);
                console.debug(
                    "[binding-http]",
                    `HttpServer on port ${this.getPort()} assigns '${href}' to Action '${actionName}'`
                );
            }

            for (const eventName in thing.events) {
                const eventNamePattern = this.updateInteractionNameWithUriVariablePattern(
                    eventName,
                    thing.events[eventName].uriVariables
                );
                const href = base + "/" + this.EVENT_DIR + "/" + eventNamePattern;
                const form = new TD.Form(href, type);
                ProtocolHelpers.updateEventFormWithTemplate(form, thing.events[eventName]);
                form.subprotocol = "longpoll";
                form.op = ["subscribeevent", "unsubscribeevent"];
                thing.events[eventName].forms.push(form);
                console.debug(
                    "[binding-http]",
                    `HttpServer on port ${this.getPort()} assigns '${href}' to Event '${eventName}'`
                );
            }
        }
    }

    private async checkCredentials(thing: ExposedThing, req: http.IncomingMessage): Promise<boolean> {
        console.debug("[binding-http]", `HttpServer on port ${this.getPort()} checking credentials for '${thing.id}'`);

        const creds = this.servient.getCredentials(thing.id);

        switch (this.httpSecurityScheme) {
            case "NoSec":
                return true;
            case "Basic": {
                const basic = bauth(req);
                const basicCreds = creds as { username: string; password: string };
                return (
                    creds !== undefined &&
                    basic !== undefined &&
                    basic.name === basicCreds.username &&
                    basic.pass === basicCreds.password
                );
            }
            case "Digest":
                return false;
            case "OAuth": {
                const oAuthScheme = thing.securityDefinitions[thing.security[0] as string] as OAuth2SecurityScheme;

                // TODO: Support security schemes defined at affordance level
                const scopes = Helpers.toStringArray(oAuthScheme.scopes); // validate call requires array of strings while oAuthScheme.scopes can be string or array of strings
                let valid = false;

                try {
                    valid = await this.oAuthValidator.validate(req, scopes, this.validOAuthClients);
                } catch (error) {
                    // TODO: should we answer differently to the client if something went wrong?
                    console.error("OAuth authorization error; sending unauthorized response error");
                    console.error("this was possibly caused by a misconfiguration of the server");
                    console.error(error);
                }

                return valid;
            }
            case "Bearer": {
                if (req.headers.authorization === undefined) return false;
                // TODO proper token evaluation
                const auth = req.headers.authorization.split(" ");
                const bearerCredentials = creds as { token: string };
                return auth[0] === "Bearer" && creds !== undefined && auth[1] === bearerCredentials.token;
            }
            default:
                return false;
        }
    }

    private fillSecurityScheme(thing: ExposedThing) {
        if (thing.securityDefinitions) {
            const secCandidate = Object.keys(thing.securityDefinitions).find((key) => {
                let scheme = thing.securityDefinitions[key].scheme as string;
                // HTTP Authentication Scheme for OAuth does not contain the version number
                // see https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml
                // remove version number for oauth2 schemes
                scheme = scheme === "oauth2" ? scheme.split("2")[0] : scheme;
                return scheme === this.httpSecurityScheme.toLowerCase();
            });

            if (!secCandidate) {
                throw new Error(
                    "Servient does not support thing security schemes. Current scheme supported: " +
                        this.httpSecurityScheme +
                        " secCandidate " +
                        Object.keys(thing.securityDefinitions).join(", ")
                );
            }

            const selectedSecurityScheme = thing.securityDefinitions[secCandidate];
            thing.securityDefinitions = {};
            thing.securityDefinitions[secCandidate] = selectedSecurityScheme;

            thing.security = [secCandidate];
        } else {
            thing.securityDefinitions = {
                noSec: { scheme: "nosec" },
            };
            thing.security = ["noSec"];
        }
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        // eslint-disable-next-line node/no-deprecated-api
        const requestUri = url.parse(req.url);

        console.debug(
            "[binding-http]",
            `HttpServer on port ${this.getPort()} received '${req.method} ${
                requestUri.pathname
            }' from ${Helpers.toUriLiteral(req.socket.remoteAddress)}:${req.socket.remotePort}`
        );
        res.on("finish", () => {
            console.debug(
                "[binding-http]",
                `HttpServer on port ${this.getPort()} replied with '${res.statusCode}' to ${Helpers.toUriLiteral(
                    req.socket.remoteAddress
                )}:${req.socket.remotePort}`
            );
        });

        // Handle requests where the path is correct and the HTTP method is not allowed.
        function respondUnallowedMethod(res: http.ServerResponse, allowed: string): void {
            // Always allow OPTIONS to handle CORS pre-flight requests
            if (!allowed.includes("OPTIONS")) {
                allowed += ", OPTIONS";
            }
            if (req.method === "OPTIONS" && req.headers.origin && req.headers["access-control-request-method"]) {
                console.debug(
                    "[binding-http]",
                    `HttpServer received an CORS preflight request from ${Helpers.toUriLiteral(
                        req.socket.remoteAddress
                    )}:${req.socket.remotePort}`
                );
                res.setHeader("Access-Control-Allow-Methods", allowed);
                res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, *");
                res.writeHead(200);
                res.end();
            } else {
                res.setHeader("Allow", allowed);
                res.writeHead(405);
                res.end("Method Not Allowed");
            }
        }

        // Set CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");

        const contentTypeHeader: string | string[] = req.headers["content-type"];
        let contentType: string = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;

        if (req.method === "PUT" || req.method === "POST") {
            if (!contentType) {
                // FIXME should be rejected with 400 Bad Request, as guessing is not good in M2M -> debug/testing flag to allow
                // FIXME would need to check if payload is present
                console.warn(
                    "[binding-http]",
                    `HttpServer on port ${this.getPort()} received no Content-Type from ${Helpers.toUriLiteral(
                        req.socket.remoteAddress
                    )}:${req.socket.remotePort}`
                );
                contentType = ContentSerdes.DEFAULT;
            } else if (
                ContentSerdes.get().getSupportedMediaTypes().indexOf(ContentSerdes.getMediaType(contentType)) < 0
            ) {
                res.writeHead(415);
                res.end("Unsupported Media Type");
                return;
            }
        }

        // route request
        let segments: string[];
        try {
            segments = decodeURI(requestUri.pathname).split("/");
        } catch (ex) {
            // catch URIError, see https://github.com/eclipse/thingweb.node-wot/issues/389
            console.warn(
                "[binding-http]",
                `HttpServer on port ${this.getPort()} cannot decode URI for '${requestUri.pathname}'`
            );
            res.writeHead(400);
            res.end("decodeURI error for " + requestUri.pathname);
            return;
        }

        if (segments[1] === "") {
            // no path -> list all Things
            if (req.method === "GET") {
                res.setHeader("Content-Type", ContentSerdes.DEFAULT);
                res.writeHead(200);
                const list = [];
                for (const address of Helpers.getAddresses()) {
                    // FIXME are Iterables really such a non-feature that I need array?
                    for (const name of Array.from(this.things.keys())) {
                        // FIXME the undefined check should NOT be necessary (however there seems to be null in it)
                        if (name) {
                            list.push(
                                this.scheme +
                                    "://" +
                                    Helpers.toUriLiteral(address) +
                                    ":" +
                                    this.getPort() +
                                    "/" +
                                    encodeURIComponent(name)
                            );
                        }
                    }
                }
                res.end(JSON.stringify(list));
            } else {
                respondUnallowedMethod(res, "GET");
            }
            // resource found and response sent
            return;
        } else {
            // path -> select Thing
            const thing: ExposedThing = this.things.get(segments[1]);
            if (thing) {
                if (segments.length === 2 || segments[2] === "") {
                    // Thing root -> send TD
                    if (req.method === "GET") {
                        const td = thing.getThingDescription();

                        // look for language negotiation through the Accept-Language header field of HTTP (e.g., "de", "de-CH", "en-US,en;q=0.5")
                        // Note: "title" on thing level is mandatory term --> check whether "titles" exists for multi-languages
                        // Note: HTTP header names are case-insensitive and req.headers seems to contain them in lowercase
                        if (req.headers["accept-language"] && req.headers["accept-language"] !== "*") {
                            if (thing.titles) {
                                const supportedLanguagesArray: string[] = []; // e.g., ['fr', 'en']

                                // collect supported languages by checking titles (given title is the only mandatory multi-lang term)
                                for (const lang in thing.titles) {
                                    supportedLanguagesArray.push(lang);
                                }

                                // the loose option allows partial matching on supported languages (e.g., returns "de" for "de-CH")
                                const prefLang = acceptLanguageParser.pick(
                                    supportedLanguagesArray,
                                    req.headers["accept-language"],
                                    { loose: true }
                                );

                                if (prefLang) {
                                    // if a preferred language can be found use it
                                    console.debug(
                                        "[binding-http]",
                                        `TD language negotiation through the Accept-Language header field of HTTP leads to "${prefLang}"`
                                    );
                                    this.resetMultiLangThing(td, prefLang);
                                }
                            }
                        }
                        res.setHeader("Content-Type", ContentSerdes.TD);
                        res.writeHead(200);
                        res.end(JSON.stringify(td));
                    } else {
                        respondUnallowedMethod(res, "GET");
                    }
                    // resource found and response sent
                    return;
                } else {
                    // Thing Interaction - Access Control
                    if (this.httpSecurityScheme !== "NoSec" && !(await this.checkCredentials(thing, req))) {
                        res.setHeader("WWW-Authenticate", `${this.httpSecurityScheme} realm="${thing.id}"`);
                        res.writeHead(401);
                        res.end();
                        return;
                    }

                    if (segments[2] === this.PROPERTY_DIR) {
                        if (segments.length === 3) {
                            // all properties
                            if (req.method === "GET") {
                                try {
                                    const propMap: PropertyContentMap = await thing.handleReadAllProperties({
                                        formIndex: 0,
                                    });
                                    res.setHeader("Content-Type", "application/json"); // contentType handling?
                                    res.writeHead(200);
                                    const recordResponse: Record<string, unknown> = {};
                                    for (const key of propMap.keys()) {
                                        const content: Content = propMap.get(key);
                                        const data = await ProtocolHelpers.readStreamFully(content.body);
                                        recordResponse[key] = data.toString();
                                    }
                                    res.end(JSON.stringify(recordResponse));
                                } catch (err) {
                                    console.error(
                                        "[binding-http]",
                                        `HttpServer on port ${this.getPort()} got internal error on invoke '${
                                            requestUri.pathname
                                        }': ${err.message}`
                                    );
                                    res.writeHead(500);
                                    res.end(err.message);
                                }
                            } else {
                                respondUnallowedMethod(res, "GET");
                            }
                            // resource found and response sent
                            return;
                        } else {
                            // sub-path -> select Property
                            const property = thing.properties[segments[3]];
                            if (property) {
                                const options: WoT.InteractionOptions & { formIndex: number } = {
                                    formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                                        property.forms,
                                        this.scheme,
                                        req.url,
                                        contentType
                                    ),
                                };
                                const uriVariables = Helpers.parseUrlParameters(
                                    req.url,
                                    thing.uriVariables,
                                    property.uriVariables
                                );
                                if (!this.isEmpty(uriVariables)) {
                                    options.uriVariables = uriVariables;
                                }

                                if (req.method === "GET") {
                                    // check if this an observable request (longpoll)
                                    if (segments[4] === this.OBSERVABLE_DIR) {
                                        const listener = async (value: Content) => {
                                            try {
                                                // send property data
                                                value.body.pipe(res);
                                            } catch (err) {
                                                if (err?.code === "ERR_HTTP_HEADERS_SENT") {
                                                    thing.handleUnobserveProperty(segments[3], listener, options);
                                                    return;
                                                }
                                                console.warn(
                                                    "[binding-http]",
                                                    `HttpServer on port ${this.getPort()} cannot process data for Property '${
                                                        segments[3]
                                                    }: ${err.message}'`
                                                );
                                                res.writeHead(500);
                                                res.end("Invalid Property Data");
                                            }
                                        };

                                        await thing.handleObserveProperty(segments[3], listener, options);

                                        res.on("finish", () => {
                                            console.debug(
                                                "[binding-http]",
                                                `HttpServer on port ${this.getPort()} closed connection`
                                            );
                                            thing.handleUnobserveProperty(segments[3], listener, options);
                                        });
                                        res.setTimeout(60 * 60 * 1000, () =>
                                            thing.handleUnobserveProperty(segments[3], listener, options)
                                        );
                                    } else {
                                        try {
                                            const content = await thing.handleReadProperty(segments[3], options);
                                            res.setHeader("Content-Type", content.type);
                                            res.writeHead(200);
                                            content.body.pipe(res);
                                        } catch (err) {
                                            console.error(
                                                "[binding-http]",
                                                `HttpServer on port ${this.getPort()} got internal error on read '${
                                                    requestUri.pathname
                                                }': ${err.message}`
                                            );
                                            res.writeHead(500);
                                            res.end(err.message);
                                        }
                                        return;
                                    }
                                } else if (req.method === "PUT") {
                                    if (!property.readOnly) {
                                        try {
                                            await thing.handleWriteProperty(
                                                segments[3],
                                                { body: req, type: contentType },
                                                options
                                            );
                                            res.writeHead(204);
                                            res.end("Changed");
                                        } catch (err) {
                                            console.error(
                                                "[binding-http]",
                                                `HttpServer on port ${this.getPort()} got internal error on invoke '${
                                                    requestUri.pathname
                                                }': ${err.message}`
                                            );
                                            res.writeHead(500);
                                            res.end(err.message);
                                        }
                                    } else {
                                        respondUnallowedMethod(res, "GET, PUT");
                                    }
                                    // resource found and response sent
                                    return;
                                } // Property exists?
                            }
                        }
                    } else if (segments[2] === this.ACTION_DIR) {
                        // sub-path -> select Action
                        const action = thing.actions[segments[3]];
                        if (action) {
                            if (req.method === "POST") {
                                const options: WoT.InteractionOptions & { formIndex: number } = {
                                    formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                                        action.forms,
                                        this.scheme,
                                        req.url,
                                        contentType
                                    ),
                                };
                                const uriVariables = Helpers.parseUrlParameters(
                                    req.url,
                                    thing.uriVariables,
                                    action.uriVariables
                                );
                                if (!this.isEmpty(uriVariables)) {
                                    options.uriVariables = uriVariables;
                                }
                                try {
                                    const output = await thing.handleInvokeAction(
                                        segments[3],
                                        { body: req, type: contentType },
                                        options
                                    );
                                    if (output) {
                                        res.setHeader("Content-Type", output.type);
                                        res.writeHead(200);
                                        output.body.pipe(res);
                                    } else {
                                        res.writeHead(200);
                                        res.end();
                                    }
                                } catch (err) {
                                    console.error(
                                        "[binding-http]",
                                        `HttpServer on port ${this.getPort()} got internal error on invoke '${
                                            requestUri.pathname
                                        }': ${err.message}`
                                    );
                                    res.writeHead(500);
                                    res.end(err.message);
                                }
                            } else {
                                respondUnallowedMethod(res, "POST");
                            }
                            // resource found and response sent
                            return;
                        } // Action exists?
                    } else if (segments[2] === this.EVENT_DIR) {
                        // sub-path -> select Event
                        const event = thing.events[segments[3]];
                        if (event) {
                            if (req.method === "GET") {
                                const options: WoT.InteractionOptions & { formIndex: number } = {
                                    formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                                        event.forms,
                                        this.scheme,
                                        req.url,
                                        contentType
                                    ),
                                };
                                const uriVariables = Helpers.parseUrlParameters(
                                    req.url,
                                    thing.uriVariables,
                                    event.uriVariables
                                );
                                if (!this.isEmpty(uriVariables)) {
                                    options.uriVariables = uriVariables;
                                }

                                const listener = async (value: Content) => {
                                    try {
                                        // send event data
                                        res.setHeader("Content-Type", value.type);
                                        res.writeHead(200);
                                        value.body.pipe(res);
                                    } catch (err) {
                                        if (err?.code === "ERR_HTTP_HEADERS_SENT") {
                                            thing.handleUnsubscribeEvent(segments[3], listener, options);
                                            return;
                                        }
                                        console.warn(
                                            "[binding-http]",
                                            `HttpServer on port ${this.getPort()} cannot process data for Event '${
                                                segments[3]
                                            }: ${err.message}'`
                                        );
                                        res.writeHead(500);
                                        res.end("Invalid Event Data");
                                    }
                                };

                                await thing.handleSubscribeEvent(segments[3], listener, options);
                                res.on("finish", () => {
                                    console.debug(
                                        "[binding-http]",
                                        `HttpServer on port ${this.getPort()} closed Event connection`
                                    );
                                    thing.handleUnsubscribeEvent(segments[3], listener, options);
                                });
                                res.setTimeout(60 * 60 * 1000, () =>
                                    thing.handleUnsubscribeEvent(segments[3], listener, options)
                                );
                            } else if (req.method === "HEAD") {
                                // HEAD support for long polling subscription
                                res.writeHead(202);
                                res.end();
                            } else {
                                respondUnallowedMethod(res, "GET");
                            }
                            // resource found and response sent
                            return;
                        } // Event exists?
                    }
                } // Interaction?
            } // Thing exists?
        }

        // resource not found
        res.writeHead(404);
        res.end("Not Found");
    }

    private isEmpty(obj: Record<string, unknown>): boolean {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
        }
        return true;
    }

    private resetMultiLangThing(thing: ThingDescription, prefLang: string) {
        // TODO can we reset "title" to another name given that title is used in URI creation?

        // update/set @language in @context
        if (thing["@context"] && Array.isArray(thing["@context"])) {
            const arrayContext: Extract<ThingDescription["@context"], [] | Array<unknown>> = thing["@context"];
            let languageSet = false;
            for (const arrayEntry of arrayContext) {
                if (arrayEntry instanceof Object) {
                    if (arrayEntry["@language"] !== undefined) {
                        arrayEntry["@language"] = prefLang;
                        languageSet = true;
                    }
                }
            }

            if (!languageSet) {
                (arrayContext as unknown[]).push({
                    "@language": prefLang,
                });
            }
        }

        // use new language title
        if (thing.titles) {
            for (const titleLang in thing.titles) {
                if (titleLang.startsWith(prefLang)) {
                    thing.title = thing.titles[titleLang];
                }
            }
        }

        // use new language description
        if (thing.descriptions) {
            for (const titleLang in thing.descriptions) {
                if (titleLang.startsWith(prefLang)) {
                    thing.description = thing.descriptions[titleLang];
                }
            }
        }

        // remove any titles or descriptions and update title / description accordingly
        delete thing.titles;
        delete thing.descriptions;

        // reset multi-language terms for interactions
        this.resetMultiLangInteraction(thing.properties, prefLang);
        this.resetMultiLangInteraction(thing.actions, prefLang);
        this.resetMultiLangInteraction(thing.events, prefLang);
    }

    private resetMultiLangInteraction(
        interactions: ThingDescription["properties"] | ThingDescription["actions"] | ThingDescription["events"],
        prefLang: string
    ) {
        if (interactions) {
            for (const interName in interactions) {
                // unset any current title and/or description
                delete interactions[interName].title;
                delete interactions[interName].description;

                // use new language title
                if (interactions[interName].titles) {
                    for (const titleLang in interactions[interName].titles) {
                        if (titleLang.startsWith(prefLang)) {
                            interactions[interName].title = interactions[interName].titles[titleLang];
                        }
                    }
                }

                // use new language description
                if (interactions[interName].descriptions) {
                    for (const descLang in interactions[interName].descriptions) {
                        if (descLang.startsWith(prefLang)) {
                            interactions[interName].description = interactions[interName].descriptions[descLang];
                        }
                    }
                }

                // unset any multilanguage titles and/or descriptions
                delete interactions[interName].titles;
                delete interactions[interName].descriptions;
            }
        }
    }
}

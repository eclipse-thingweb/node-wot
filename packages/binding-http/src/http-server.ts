/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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

import { AddressInfo } from "net";

import * as TD from "@node-wot/td-tools";
import Servient, {
    ProtocolServer,
    ContentSerdes,
    Helpers,
    ExposedThing,
    ProtocolHelpers,
    createLoggers,
} from "@node-wot/core";
import { HttpConfig, HttpForm, OAuth2ServerConfig } from "./http";
import createValidator, { Validator } from "./oauth-token-validation";
import { OAuth2SecurityScheme } from "@node-wot/td-tools";
import slugify from "slugify";
import { ActionElement, EventElement, PropertyElement } from "wot-thing-description-types";
import { MiddlewareRequestHandler } from "./http-server-middleware";
import Router from "find-my-way";
import thingsRoute from "./routes/things";
import thingDescriptionRoute from "./routes/thing-description";
import propertyRoute from "./routes/property";
import actionRoute from "./routes/action";
import eventRoute from "./routes/event";
import propertiesRoute from "./routes/properties";
import propertyObserveRoute from "./routes/property-observe";

const { debug, info, warn, error } = createLoggers("binding-http", "http-server");

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
    private readonly urlRewrite: Record<string, string> = undefined;
    private readonly httpSecurityScheme: string = "NoSec"; // HTTP header compatible string
    private readonly validOAuthClients: RegExp = /.*/g;
    private readonly server: http.Server | https.Server = null;
    private readonly middleware: MiddlewareRequestHandler = null;
    private readonly things: Map<string, ExposedThing> = new Map<string, ExposedThing>();
    private servient: Servient = null;
    private oAuthValidator: Validator;
    private router: Router.Instance<Router.HTTPVersion.V1>;

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
            info(`HttpServer Port Overridden to ${environmentObj.value} by Environment Variable ${environmentObj.key}`);
            this.port = +environmentObj.value;
        }

        if (config.address !== undefined) {
            this.address = config.address;
        }
        if (config.baseUri !== undefined) {
            this.baseUri = config.baseUri;
        }
        if (config.urlRewrite !== undefined) {
            this.urlRewrite = config.urlRewrite;
        }
        if (config.middleware !== undefined) {
            this.middleware = config.middleware;
        }

        const router = Router({
            defaultRoute(req, res) {
                // url-rewrite feature in use ?
                const pathname = req.url;
                if (config.urlRewrite) {
                    const entryUrl = pathname;
                    const internalUrl = config.urlRewrite[entryUrl];
                    if (internalUrl) {
                        req.url = internalUrl;
                        router.lookup(req, res, this);
                        debug("[binding-http]", `URL "${entryUrl}" has been rewritten to "${pathname}"`);
                        return;
                    }
                }

                // No url-rewrite mapping found -> resource not found
                res.writeHead(404);
                res.end("Not Found");
            },
        });

        this.router = router;

        this.router.get("/", thingsRoute);
        this.router.get("/:thing", thingDescriptionRoute);
        this.router.on(["GET", "HEAD", "OPTIONS"], "/:thing/" + this.PROPERTY_DIR, propertiesRoute);
        this.router.on(["GET", "PUT", "HEAD", "OPTIONS"], "/:thing/" + this.PROPERTY_DIR + "/:property", propertyRoute);
        this.router.on(
            ["GET", "HEAD", "OPTIONS"],
            "/:thing/" + this.PROPERTY_DIR + "/:property/" + this.OBSERVABLE_DIR,
            propertyObserveRoute
        );
        this.router.on(["POST", "OPTIONS"], "/:thing/" + this.ACTION_DIR + "/:action", actionRoute);
        this.router.on(["GET", "HEAD", "OPTIONS"], "/:thing/" + this.EVENT_DIR + "/:event", eventRoute);

        // TLS
        if (config.serverKey && config.serverCert) {
            const options: https.ServerOptions = {};
            options.key = fs.readFileSync(config.serverKey);
            options.cert = fs.readFileSync(config.serverCert);
            this.scheme = "https";
            this.server = https.createServer(options, (req, res) => {
                if (this.middleware) {
                    this.middleware(req, res, () => {
                        this.handleRequest(req, res);
                    });
                } else {
                    this.handleRequest(req, res);
                }
            });
        } else {
            this.scheme = "http";
            this.server = http.createServer((req, res) => {
                if (this.middleware) {
                    this.middleware(req, res, () => {
                        this.handleRequest(req, res);
                    });
                } else {
                    this.handleRequest(req, res);
                }
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
        info(`HttpServer starting on ${this.address !== undefined ? this.address + " " : ""}port ${this.port}`);
        return new Promise<void>((resolve, reject) => {
            // store servient to get credentials
            this.servient = servient;

            // long timeout for long polling
            this.server.setTimeout(60 * 60 * 1000, () => {
                debug(`HttpServer on port ${this.getPort()} timed out connection`);
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
                    error(`HttpServer on port ${this.port} failed: ${err.message}`);
                });
                resolve();
            });
            this.server.listen(this.port, this.address);
        });
    }

    public stop(): Promise<void> {
        info(`HttpServer stopping on port ${this.getPort()}`);
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

    public getThings(): Map<string, ExposedThing> {
        return this.things;
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
        uriVariables: PropertyElement["uriVariables"] = {},
        thingVariables: PropertyElement["uriVariables"] = {}
    ): string {
        const variables = Object.assign({}, uriVariables, thingVariables);
        if (Object.keys(variables).length > 0) {
            let pattern = "{?";
            let index = 0;
            if (uriVariables) {
                for (const key in uriVariables) {
                    if (index !== 0) {
                        pattern += ",";
                    }
                    pattern += encodeURIComponent(key);
                    index++;
                }
            }
            if (thingVariables) {
                for (const key in thingVariables) {
                    if (index !== 0) {
                        pattern += ",";
                    }
                    pattern += encodeURIComponent(key);
                    index++;
                }
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
            debug(`HttpServer on port ${this.getPort()} exposes '${thing.title}' as unique '/${urlPath}'`);
            this.things.set(urlPath, thing);

            if (this.baseUri !== undefined) {
                const base: string = this.baseUri.concat("/", encodeURIComponent(urlPath));
                info("HttpServer TD hrefs using baseUri " + this.baseUri);
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
        debug(`HttpServer on port ${this.getPort()} destroying thingId '${thingId}'`);
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
                info(`HttpServer successfully destroyed '${removedThing.title}'`);
            } else {
                info(`HttpServer failed to destroy thing with thingId '${thingId}'`);
            }
            resolve(removedThing !== undefined);
        });
    }

    private addUrlRewriteEndpoints(form: TD.Form, forms: Array<TD.Form>): void {
        if (this.urlRewrite) {
            for (const inUri in this.urlRewrite) {
                const toUri = this.urlRewrite[inUri];
                if (form.href.endsWith(toUri)) {
                    const form2: TD.Form = JSON.parse(JSON.stringify(form)); // deep copy
                    form2.href = form2.href.substring(0, form.href.lastIndexOf(toUri)) + inUri;
                    forms.push(form2);
                    debug(`HttpServer on port ${this.getPort()} assigns urlRewrite '${form2.href}' for '${form.href}'`);
                }
            }
        }
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
                }
                if (!thing.properties[propertyName].writeOnly) {
                    allWriteOnly = false;
                }
            }
            if (anyProperties) {
                const href = base + "/" + this.PROPERTY_DIR;
                const form = new TD.Form(href, type);
                if (allReadOnly && !allWriteOnly) {
                    form.op = ["readallproperties", "readmultipleproperties"];
                } else if (allWriteOnly && !allReadOnly) {
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
                this.addUrlRewriteEndpoints(form, thing.forms);
            }

            for (const propertyName in thing.properties) {
                const propertyNamePattern = this.updateInteractionNameWithUriVariablePattern(
                    propertyName,
                    thing.properties[propertyName].uriVariables,
                    thing.uriVariables
                );
                const href = base + "/" + this.PROPERTY_DIR + "/" + propertyNamePattern;
                const form = new TD.Form(href, type);
                ProtocolHelpers.updatePropertyFormWithTemplate(
                    form,
                    (tdTemplate?.properties[propertyName] ?? {}) as PropertyElement
                );
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
                debug(`HttpServer on port ${this.getPort()} assigns '${href}' to Property '${propertyName}'`);
                this.addUrlRewriteEndpoints(form, thing.properties[propertyName].forms);

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
                    debug(
                        `HttpServer on port ${this.getPort()} assigns '${href}' to observable Property '${propertyName}'`
                    );
                    this.addUrlRewriteEndpoints(form, thing.properties[propertyName].forms);
                }
            }

            for (const actionName in thing.actions) {
                const actionNamePattern = this.updateInteractionNameWithUriVariablePattern(
                    actionName,
                    thing.actions[actionName].uriVariables,
                    thing.uriVariables
                );
                const href = base + "/" + this.ACTION_DIR + "/" + actionNamePattern;
                const form = new TD.Form(href, type);
                ProtocolHelpers.updateActionFormWithTemplate(
                    form,
                    (tdTemplate?.actions[actionName] ?? {}) as ActionElement
                );
                form.op = ["invokeaction"];
                const hform: HttpForm = form;
                if (hform["htv:methodName"] === undefined) {
                    hform["htv:methodName"] = "POST";
                }
                thing.actions[actionName].forms.push(form);
                debug(`HttpServer on port ${this.getPort()} assigns '${href}' to Action '${actionName}'`);
                this.addUrlRewriteEndpoints(form, thing.actions[actionName].forms);
            }

            for (const eventName in thing.events) {
                const eventNamePattern = this.updateInteractionNameWithUriVariablePattern(
                    eventName,
                    thing.events[eventName].uriVariables,
                    thing.uriVariables
                );
                const href = base + "/" + this.EVENT_DIR + "/" + eventNamePattern;
                const form = new TD.Form(href, type);
                ProtocolHelpers.updateEventFormWithTemplate(
                    form,
                    (tdTemplate?.events[eventName] ?? {}) as EventElement
                );
                form.subprotocol = "longpoll";
                form.op = ["subscribeevent", "unsubscribeevent"];
                thing.events[eventName].forms.push(form);
                debug(`HttpServer on port ${this.getPort()} assigns '${href}' to Event '${eventName}'`);
                this.addUrlRewriteEndpoints(form, thing.events[eventName].forms);
            }
        }
    }

    public async checkCredentials(thing: ExposedThing, req: http.IncomingMessage): Promise<boolean> {
        debug(`HttpServer on port ${this.getPort()} checking credentials for '${thing.id}'`);

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
                    error("OAuth authorization error; sending unauthorized response error");
                    error("this was possibly caused by a misconfiguration of the server");
                    error(`${error}`);
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
        const requestUri = new URL(req.url, `${this.scheme}://${req.headers.host}`);

        debug(
            `HttpServer on port ${this.getPort()} received '${req.method} ${
                requestUri.pathname
            }' from ${Helpers.toUriLiteral(req.socket.remoteAddress)}:${req.socket.remotePort}`
        );
        res.on("finish", () => {
            debug(
                `HttpServer on port ${this.getPort()} replied with '${res.statusCode}' to ${Helpers.toUriLiteral(
                    req.socket.remoteAddress
                )}:${req.socket.remotePort}`
            );
        });

        // Set CORS headers
        if (this.httpSecurityScheme !== "NoSec" && req.headers.origin) {
            res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
        } else {
            res.setHeader("Access-Control-Allow-Origin", "*");
        }

        const contentTypeHeader: string | string[] = req.headers["content-type"];
        let contentType: string = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;

        if (req.method === "PUT" || req.method === "POST") {
            if (!contentType) {
                // FIXME should be rejected with 400 Bad Request, as guessing is not good in M2M -> debug/testing flag to allow
                // FIXME would need to check if payload is present
                warn(
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

        this.router.lookup(req, res, this);
    }
}

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
 * CoAP Server based on coap by mcollina
 */

import * as TD from "@node-wot/td-tools";
import Servient, {
    ProtocolServer,
    ContentSerdes,
    ExposedThing,
    Helpers,
    ProtocolHelpers,
    Content,
    createLoggers,
} from "@node-wot/core";
import { Socket } from "dgram";
import { Server, createServer, registerFormat, IncomingMessage, OutgoingMessage } from "coap";
import slugify from "slugify";
import { Readable } from "stream";
import { MdnsIntroducer } from "./mdns-introducer";
import { PropertyElement, DataSchema } from "wot-thing-description-types";
import { CoapServerConfig } from "./coap";
import { DataSchemaValue } from "wot-typescript-definitions";

const { debug, warn, info, error } = createLoggers("binding-coap", "coap-server");

type CoreLinkFormatParameters = Map<string, string[] | number[]>;

// TODO: Move to core?
type AugmentedInteractionOptions = WoT.InteractionOptions & { formIndex: number };

const thingDescriptionParameters: CoreLinkFormatParameters = new Map(
    Object.entries({
        rt: ["wot.thing"],
        ct: [50, 432],
    })
);

interface CoreLinkFormatResource {
    urlPath: string;
    parameters?: CoreLinkFormatParameters;
}

export default class CoapServer implements ProtocolServer {
    public readonly scheme: string = "coap";

    private readonly PROPERTY_DIR = "properties";
    private readonly ACTION_DIR = "actions";
    private readonly EVENT_DIR = "events";

    private readonly port: number;
    private readonly address?: string;

    private mdnsIntroducer?: MdnsIntroducer;

    private readonly server: Server = createServer(
        { reuseAddr: false },
        (req: IncomingMessage, res: OutgoingMessage) => {
            this.handleRequest(req, res);
        }
    );

    private readonly things: Map<string, ExposedThing> = new Map<string, ExposedThing>();

    private readonly coreResources = new Map<string, CoreLinkFormatResource>();

    constructor(config?: CoapServerConfig) {
        this.port = config?.port ?? 5683;
        this.address = config?.address;

        // WoT-specific content formats
        registerFormat(ContentSerdes.JSON_LD, 2100);
    }

    public start(servient: Servient): Promise<void> {
        info(`CoapServer starting on ${this.address !== undefined ? this.address + " " : ""}port ${this.port}`);
        return new Promise<void>((resolve, reject) => {
            // start promise handles all errors until successful start
            this.server.once("error", (err: Error) => {
                reject(err);
            });
            this.server.listen(this.port, this.address, () => {
                // once started, console "handles" errors
                this.server.on("error", (err: Error) => {
                    error(`CoapServer for port ${this.port} failed: ${err.message}`);
                });
                this.mdnsIntroducer = new MdnsIntroducer(this.address);
                resolve();
            });
        });
    }

    private closeServer(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // stop promise handles all errors from now on
            this.server.once("error", (err: Error) => {
                reject(err);
            });
            this.server.close(() => {
                resolve();
            });
        });
    }

    public async stop(): Promise<void> {
        info(`CoapServer stopping on port ${this.getPort()}`);
        await this.closeServer();
        await this.mdnsIntroducer?.close();
    }

    /** returns socket to be re-used by CoapClients */
    public getSocket(): Socket {
        // FIXME: node-coap needs an explicit getter for this
        return this.server._sock as Socket;
    }

    /** returns server port number and indicates that server is running when larger than -1  */
    public getPort(): number {
        if (this.server._sock) {
            const socket = this.server._sock as Socket;
            return socket.address().port;
        } else {
            return -1;
        }
    }

    public async expose(thing: ExposedThing, tdTemplate?: WoT.ExposedThingInit): Promise<void> {
        const port = this.getPort();
        const urlPath = this.createThingUrlPath(thing);

        if (port === -1) {
            warn("CoapServer is assigned an invalid port, aborting expose process.");
            return;
        }

        this.fillInBindingData(thing, port, urlPath);

        debug(`CoapServer on port ${port} exposes '${thing.title}' as unique '/${urlPath}'`);

        this.setUpIntroductionMethods(thing, urlPath, port);
    }

    private createThingUrlPath(thing: ExposedThing) {
        const urlPath = slugify(thing.title, { lower: true });

        if (this.things.has(urlPath)) {
            return Helpers.generateUniqueName(urlPath);
        }

        return urlPath;
    }

    private fillInBindingData(thing: ExposedThing, port: number, urlPath: string) {
        const addresses = Helpers.getAddresses();
        const offeredMediaTypes = ContentSerdes.get().getOfferedMediaTypes();

        for (const address of addresses) {
            for (const offeredMediaType of offeredMediaTypes) {
                const base = this.createThingBase(address, port, urlPath);

                this.fillInMetaPropertiesBindingData(thing, base, offeredMediaType);

                this.fillInPropertyBindingData(thing, base, offeredMediaType);
                this.fillInActionBindingData(thing, base, offeredMediaType);
                this.fillInEventBindingData(thing, base, offeredMediaType);
            }
        }
    }

    private createThingBase(address: string, port: number, urlPath: string): string {
        return `${this.scheme}://${address}:${port}/${encodeURIComponent(urlPath)}`;
    }

    private fillInMetaPropertiesBindingData(thing: ExposedThing, base: string, offeredMediaType: string) {
        const opValues = this.createPropertyMetaOpValues(thing);

        if (opValues.length === 0) {
            return;
        }

        if (thing.forms == null) {
            thing.forms = [];
        }

        const form = this.createAffordanceForm(base, this.PROPERTY_DIR, offeredMediaType, opValues, thing.uriVariables);

        thing.forms.push(form);
    }

    private getReadableProperties(thing: ExposedThing) {
        return Object.entries(thing.properties).filter(([_, value]) => value.writeOnly !== true);
    }

    private createPropertyMetaOpValues(thing: ExposedThing): string[] {
        const properties = Object.values(thing.properties);
        const numberOfProperties = properties.length;

        if (numberOfProperties === 0) {
            return [];
        }

        const readableProperties = this.getReadableProperties(thing).length;

        const opValues: string[] = [];

        if (readableProperties > 0) {
            opValues.push("readmultipleproperties");
        }

        if (readableProperties === numberOfProperties) {
            opValues.push("readallproperties");
        }

        return opValues;
    }

    private fillInPropertyBindingData(thing: ExposedThing, base: string, offeredMediaType: string) {
        for (const [propertyName, property] of Object.entries(thing.properties)) {
            const opValues = ProtocolHelpers.getPropertyOpValues(property);
            const form = this.createAffordanceForm(
                base,
                this.PROPERTY_DIR,
                offeredMediaType,
                opValues,
                thing.uriVariables,
                propertyName,
                property.uriVariables
            );

            property.forms.push(form);
            this.logHrefAssignment(form, "Property", propertyName);
        }
    }

    private fillInActionBindingData(thing: ExposedThing, base: string, offeredMediaType: string) {
        for (const [actionName, action] of Object.entries(thing.actions)) {
            const form = this.createAffordanceForm(
                base,
                this.ACTION_DIR,
                offeredMediaType,
                "invokeaction",
                thing.uriVariables,
                actionName,
                action.uriVariables
            );

            action.forms.push(form);
            this.logHrefAssignment(form, "Action", actionName);
        }
    }

    private fillInEventBindingData(thing: ExposedThing, base: string, offeredMediaType: string) {
        for (const [eventName, event] of Object.entries(thing.events)) {
            const form = this.createAffordanceForm(
                base,
                this.EVENT_DIR,
                offeredMediaType,
                ["subscribeevent", "unsubscribeevent"],
                thing.uriVariables,
                eventName,
                event.uriVariables
            );

            event.forms.push(form);
            this.logHrefAssignment(form, "Event", eventName);
        }
    }

    private createAffordanceForm(
        base: string,
        affordancePathSegment: string,
        offeredMediaType: string,
        opValues: string | string[],
        thingUriVariables: PropertyElement["uriVariables"],
        affordanceName?: string,
        affordanceUriVariables?: PropertyElement["uriVariables"]
    ): TD.Form {
        const affordanceNamePattern = Helpers.updateInteractionNameWithUriVariablePattern(
            affordanceName ?? "",
            affordanceUriVariables,
            thingUriVariables
        );

        let href = `${base}/${affordancePathSegment}`;

        if (affordanceNamePattern.length > 0) {
            href += `/${encodeURIComponent(affordanceNamePattern)}`;
        }

        const form = new TD.Form(href, offeredMediaType);
        form.op = opValues;

        return form;
    }

    private logHrefAssignment(form: TD.Form, affordanceType: string, affordanceName: string) {
        debug(`CoapServer on port ${this.port} assigns '${form.href}' to ${affordanceType} '${affordanceName}'`);
    }

    private setUpIntroductionMethods(thing: ExposedThing, urlPath: string, port: number) {
        this.createCoreResource(urlPath);
        this.things.set(urlPath, thing);

        const parameters = {
            urlPath,
            port,
            serviceName: "_wot._udp.local",
        };

        this.mdnsIntroducer?.registerExposedThing(thing, parameters);
    }

    private createCoreResource(urlPath: string): void {
        this.coreResources.set(urlPath, { urlPath, parameters: thingDescriptionParameters });
    }

    public async destroy(thingId: string): Promise<boolean> {
        debug(`CoapServer on port ${this.getPort()} destroying thingId '${thingId}'`);
        for (const name of this.things.keys()) {
            const exposedThing = this.things.get(name);
            if (exposedThing?.id === thingId) {
                this.things.delete(name);
                this.coreResources.delete(name);
                this.mdnsIntroducer?.delete(name);

                info(`CoapServer succesfully destroyed '${exposedThing.title}'`);
                return true;
            }
        }

        info(`CoapServer failed to destroy thing with thingId '${thingId}'`);
        return false;
    }

    private formatCoreLinkFormatResources() {
        return Array.from(this.coreResources.values())
            .map((resource) => {
                const formattedPath = `</${resource.urlPath}>`;
                const parameters = Array.from(resource.parameters?.entries() ?? []);

                const parameterValues = parameters.map((parameter) => {
                    const key = parameter[0];
                    const values = parameter[1].join(" ");
                    return `${key}="${values}"`;
                });

                return [formattedPath, ...parameterValues].join(";");
            })
            .join(",");
    }

    private handleWellKnownCore(req: IncomingMessage, res: OutgoingMessage) {
        if (req.method !== "GET") {
            this.sendMethodNotAllowedResponse(res);
            return;
        }

        const payload = this.formatCoreLinkFormatResources();
        this.sendContentResponse(res, payload, "application/link-format");
    }

    /**
     * Handles a CoAP request for an ExposedThing, negotiates the TD Content-Format and sends
     * a response.
     *
     * If a specific Content-Format for the TD is requested by a client, as indicated by
     * an Accept option, it will be set for the outgoing response if it is supported.
     * If no Accept option is set, the default Content-Format will be used as a fallback.
     *
     * If an Accept option is present but the Content-Format is not supported, the response
     * will be sent with a status code `4.06` (Not Acceptable) and an error
     * message as a diagnostic payload in accordance with RFC 7252, sections 5.10.4 and
     * 5.5.2.
     *
     * @param req The incoming request.
     * @param res The outgoing response.
     * @param thing The ExposedThing whose TD is requested.
     */
    private async handleTdRequest(req: IncomingMessage, res: OutgoingMessage, thing: ExposedThing) {
        if (req.method !== "GET") {
            this.sendMethodNotAllowedResponse(res);
            return;
        }

        const { contentType, isSupported } = this.processAcceptValue(req);

        if (!isSupported) {
            this.sendResponse(res, "4.06", `Content-Format ${contentType} is not supported by this resource.`);
            return;
        }

        const content = ContentSerdes.get().valueToContent(thing.getThingDescription(), undefined, contentType);
        const payload = await content.toBuffer();

        debug(`Sending CoAP response for TD with Content-Format ${contentType}.`);
        this.sendContentResponse(res, payload, contentType);
    }

    private processAcceptValue(req: IncomingMessage) {
        const accept = req.headers.Accept;

        if (typeof accept !== "string") {
            debug(`Request contained no Accept option.`);
            return {
                contentType: ContentSerdes.TD,
                isSupported: true,
            };
        }

        const isSupported = ContentSerdes.get().isSupported(accept);

        if (!isSupported) {
            debug(`Request contained an accept option with value ${accept} which is not supported.`);
        }

        debug(`Received an available Content-Format ${accept} in Accept option.`);
        return {
            contentType: accept,
            isSupported,
        };
    }

    private async handleRequest(req: IncomingMessage, res: OutgoingMessage) {
        const origin = this.formatRequestOrigin(req);

        debug(
            `CoapServer on port ${this.getPort()} received '${req.method}(${req._packet.messageId}) ${
                req.url
            }' from ${origin}`
        );
        res.on("finish", () => debug(`CoapServer replied with '${res.code}' to ${origin}`));

        const contentType = this.getContentTypeFromRequest(req);
        const method = req.method;

        if (!this.checkContentTypeSupportForInput(method, contentType)) {
            this.sendResponse(res, "4.15", "Unsupported Media Type");
            return;
        }

        const requestUri = this.processRequestUri(req);

        if (requestUri === "/") {
            this.handleThingsRequest(method, res);
            return;
        }

        if (requestUri === "/.well-known/core") {
            this.handleWellKnownCore(req, res);
            return;
        }

        const { thingKey, affordanceType, affordanceKey } = this.parseUriSegments(requestUri);
        const thing = this.things.get(thingKey);

        if (thing == null) {
            this.sendNotFoundResponse(res);
            return;
        }

        // TODO: Remove support for trailing slashes (or rather: trailing empty URI path segments)
        if (affordanceType == null || affordanceType === "") {
            await this.handleTdRequest(req, res, thing);
            return;
        }

        switch (affordanceType) {
            case this.PROPERTY_DIR:
                this.handlePropertyRequest(thing, affordanceKey, req, res, contentType);
                break;
            case this.ACTION_DIR:
                this.handleActionRequest(thing, affordanceKey, req, res, contentType);
                break;
            case this.EVENT_DIR:
                this.handleEventRequest(thing, affordanceKey, req, res, contentType);
                break;
            default:
                this.sendNotFoundResponse(res);
        }
    }

    private processRequestUri(req: IncomingMessage) {
        const uri = req.url;

        if (uri.includes("?")) {
            return uri.substring(0, uri.indexOf("?"));
        }

        return uri;
    }

    private handleThingsRequest(method: string, res: OutgoingMessage) {
        if (method !== "GET") {
            this.sendMethodNotAllowedResponse(res);
            return;
        }

        const payload = JSON.stringify(this.getThingDescriptionPayload());
        this.sendContentResponse(res, payload, ContentSerdes.DEFAULT);
    }

    private async handlePropertyRequest(
        thing: ExposedThing,
        affordanceKey: string,
        req: IncomingMessage,
        res: OutgoingMessage,
        contentType: string
    ) {
        const property = thing.properties[affordanceKey];

        if (property == null) {
            this.handlePropertiesRequest(req, contentType, thing, res);
            return;
        }

        switch (req.method) {
            case "GET":
                if (req.headers.Observe == null) {
                    this.handleReadProperty(property, req, contentType, thing, res, affordanceKey);
                } else {
                    this.handleObserveProperty(property, req, contentType, thing, res, affordanceKey);
                }
                break;
            case "PUT":
                if (property.readOnly === true) {
                    this.sendResponse(res, "4.00", "Property readOnly");
                    return;
                }

                this.handleWriteProperty(property, req, contentType, thing, res, affordanceKey);
                break;
            default:
                this.sendMethodNotAllowedResponse(res);
        }
    }

    private async handlePropertiesRequest(
        req: IncomingMessage,
        contentType: string,
        thing: ExposedThing,
        res: OutgoingMessage
    ) {
        const forms = thing.forms;

        if (forms == null) {
            this.sendNotFoundResponse(res);
            return;
        }

        switch (req.method) {
            case "GET":
                this.handleReadMultipleProperties(forms, req, contentType, thing, res);
                break;
            default:
                this.sendMethodNotAllowedResponse(res);
                break;
        }
    }

    private async handleReadMultipleProperties(
        forms: TD.Form[],
        req: IncomingMessage,
        contentType: string,
        thing: ExposedThing,
        res: OutgoingMessage
    ) {
        try {
            const interactionOptions = this.createInteractionOptions(
                forms,
                thing,
                req,
                contentType,
                thing.uriVariables
            );
            const readablePropertyKeys = this.getReadableProperties(thing).map(([key, _]) => key);
            const contentMap = await thing.handleReadMultipleProperties(readablePropertyKeys, interactionOptions);

            const recordResponse: Record<string, DataSchemaValue> = {};
            for (const [key, content] of contentMap.entries()) {
                const value = ContentSerdes.get().contentToValue(
                    { type: ContentSerdes.DEFAULT, body: await content.toBuffer() },
                    {}
                );

                if (value == null) {
                    // TODO: How should this case be handled?
                    continue;
                }

                recordResponse[key] = value;
            }

            const content = ContentSerdes.get().valueToContent(recordResponse, undefined, contentType);
            this.streamContentResponse(res, content);
        } catch (err) {
            const errorMessage = `${err}`;
            error(`CoapServer on port ${this.getPort()} got internal error on read '${req.url}': ${errorMessage}`);
            this.sendResponse(res, "5.00", errorMessage);
        }
    }

    private async handleReadProperty(
        property: PropertyElement,
        req: IncomingMessage,
        contentType: string,
        thing: ExposedThing,
        res: OutgoingMessage,
        affordanceKey: string
    ) {
        try {
            const interactionOptions = this.createInteractionOptions(
                property.forms,
                thing,
                req,
                contentType,
                property.uriVariables
            );
            const content = await thing.handleReadProperty(affordanceKey, interactionOptions);
            this.streamContentResponse(res, content);
        } catch (err) {
            const errorMessage = `${err}`;
            error(`CoapServer on port ${this.getPort()} got internal error on read '${req.url}': ${errorMessage}`);
            this.sendResponse(res, "5.00", errorMessage);
        }
    }

    private async handleObserveProperty(
        property: PropertyElement,
        req: IncomingMessage,
        contentType: string,
        thing: ExposedThing,
        res: OutgoingMessage,
        affordanceKey: string
    ) {
        const interactionOptions = this.createInteractionOptions(
            property.forms,
            thing,
            req,
            contentType,
            property.uriVariables
        );

        const listener = this.createContentListener(req, res, this.PROPERTY_DIR, affordanceKey);

        try {
            await thing.handleObserveProperty(affordanceKey, listener, interactionOptions);
        } catch (error) {
            warn(`${error}`);
        }

        res.end();

        res.on("finish", (err: Error) => {
            if (err) {
                error(`CoapServer on port ${this.port} failed on observe with: ${err.message}`);
            }
            thing.handleUnobserveProperty(affordanceKey, listener, interactionOptions);
        });

        setTimeout(() => thing.handleUnobserveProperty(affordanceKey, listener, interactionOptions), 60 * 60 * 1000);
    }

    private createContentListener(
        req: IncomingMessage,
        res: OutgoingMessage,
        affordanceType: string,
        affordanceKey: string
    ) {
        return async (content: Content) => {
            try {
                debug(
                    `CoapServer on port ${this.getPort()} sends notification to ${Helpers.toUriLiteral(
                        req.rsinfo.address
                    )}:${req.rsinfo.port}`
                );
                this.streamContentResponse(res, content, { end: true });
            } catch (err) {
                const code = "5.00";

                if (affordanceType === this.EVENT_DIR) {
                    debug(`CoapServer on port ${this.getPort()} failed '${affordanceKey}' subscription`);
                    this.sendResponse(res, code, "Subscription to event failed");
                } else {
                    const errorMessage = `${err}`;
                    debug(
                        `CoapServer on port ${this.getPort()} got internal error on observe '${
                            req.url
                        }': ${errorMessage}`
                    );
                    this.sendResponse(res, code, errorMessage);
                }
            }
        };
    }

    private async handleWriteProperty(
        property: PropertyElement,
        req: IncomingMessage,
        contentType: string,
        thing: ExposedThing,
        res: OutgoingMessage,
        affordanceKey: string
    ) {
        try {
            const interactionOptions = this.createInteractionOptions(
                property.forms,
                thing,
                req,
                contentType,
                property.uriVariables
            );
            await thing.handleWriteProperty(
                affordanceKey,
                new Content(contentType, Readable.from(req.payload)),
                interactionOptions
            );
            this.sendChangedResponse(res);
        } catch (err) {
            const errorMessage = `${err}`;
            error(`CoapServer on port ${this.getPort()} got internal error on write '${req.url}': ${errorMessage}`);
            this.sendResponse(res, "5.00", errorMessage);
        }
    }

    private async handleActionRequest(
        thing: ExposedThing,
        affordanceKey: string,
        req: IncomingMessage,
        res: OutgoingMessage,
        contentType: string
    ) {
        const action = thing.actions[affordanceKey];

        if (action == null) {
            this.sendNotFoundResponse(res);
            return;
        }

        if (req.method !== "POST") {
            this.sendMethodNotAllowedResponse(res);
            return;
        }

        const interactionOptions = this.createInteractionOptions(
            action.forms,
            thing,
            req,
            contentType,
            action.uriVariables
        );
        try {
            const output = await thing.handleInvokeAction(
                affordanceKey,
                new Content(contentType, Readable.from(req.payload)),
                interactionOptions
            );
            if (output) {
                this.streamContentResponse(res, output, { end: true });
            } else {
                this.sendChangedResponse(res);
            }
        } catch (errror) {
            const errorMessage = `${error}`;
            error(`CoapServer on port ${this.getPort()} got internal error on invoke '${req.url}': ${errorMessage}`);
            this.sendResponse(res, "5.00", errorMessage);
        }
    }

    private createInteractionOptions(
        forms: TD.Form[],
        thing: ExposedThing,
        req: IncomingMessage,
        contentType: string,
        affordanceUriVariables?: { [k: string]: DataSchema }
    ) {
        const options: AugmentedInteractionOptions = {
            formIndex: ProtocolHelpers.findRequestMatchingFormIndex(forms, this.scheme, req.url, contentType),
        };
        const uriVariables = Helpers.parseUrlParameters(req.url, thing.uriVariables, affordanceUriVariables);
        if (!this.isEmpty(uriVariables)) {
            options.uriVariables = uriVariables;
        }

        return options;
    }

    private async handleEventRequest(
        thing: ExposedThing,
        affordanceKey: string,
        req: IncomingMessage,
        res: OutgoingMessage,
        contentType: string
    ) {
        const event = thing.events[affordanceKey];

        if (event == null) {
            this.sendNotFoundResponse(res);
            return;
        }

        if (req.method !== "GET") {
            this.sendMethodNotAllowedResponse(res);
            return;
        }

        const observe = req.headers.Observe as number;

        if (observe == null) {
            debug(
                `CoapServer on port ${this.getPort()} rejects '${affordanceKey}' event subscription from ${Helpers.toUriLiteral(
                    req.rsinfo.address
                )}:${req.rsinfo.port}`
            );
            this.sendResponse(res, "4.00", "No Observe Option");
            return;
        }

        if (observe === 0) {
            this.avoidDuplicatedObserveRegistration(res); // TODO: Get rid of this workaround

            const interactionOptions = this.createInteractionOptions(
                event.forms,
                thing,
                req,
                contentType,
                event.uriVariables
            );

            const listener = this.createContentListener(req, res, this.EVENT_DIR, affordanceKey);

            try {
                await thing.handleSubscribeEvent(affordanceKey, listener, interactionOptions);
            } catch (error) {
                warn(`${error}`);
            }

            res.end();

            res.on("finish", () => {
                debug(
                    `CoapServer on port ${this.getPort()} ends '${affordanceKey}' observation from ${Helpers.toUriLiteral(
                        req.rsinfo.address
                    )}:${req.rsinfo.port}`
                );
                thing.handleUnsubscribeEvent(affordanceKey, listener, interactionOptions);
            });
        } else if (observe > 0) {
            debug(
                `CoapServer on port ${this.getPort()} sends '${affordanceKey}' response to ${Helpers.toUriLiteral(
                    req.rsinfo.address
                )}:${req.rsinfo.port}`
            );
            // TODO: Check if this has been fixed in the meantime
            // node-coap does not support GET cancellation
            this.sendResponse(res, "5.01", "node-coap issue: no GET cancellation, send RST");
        }
    }

    /**
     * Work-around to avoid duplicate requests in the case of observe
     * registration (resend due to no response)
     *
     * (node-coap does not deduplicate when Observe is set)
     *
     * @param res The response that is being prepared for the observe registration request
     */
    private avoidDuplicatedObserveRegistration(res: OutgoingMessage) {
        const packet = res._packet;
        packet.code = "0.00";
        packet.payload = Buffer.from("");
        packet.reset = false;
        packet.ack = true;
        packet.token = Buffer.alloc(0);

        res._send(res, packet);

        res._packet.confirmable = res._request.confirmable;
        res._packet.token = res._request.token;
    }

    private getContentTypeFromRequest(req: IncomingMessage): string {
        const contentType = req.headers["Content-Format"] as string;

        if (contentType == null) {
            warn(
                `CoapServer on port ${this.getPort()} received no Content-Format from ${Helpers.toUriLiteral(
                    req.rsinfo.address
                )}:${req.rsinfo.port}`
            );
        }

        return contentType ?? ContentSerdes.DEFAULT;
    }

    private checkContentTypeSupportForInput(method: string, contentType: string) {
        const methodsWithPayload: string[] = ["PUT", "POST", "FETCH", "iPATCH", "PATCH"];
        const notAMethodWithPayload = !methodsWithPayload.includes(method);

        return notAMethodWithPayload || ContentSerdes.get().isSupported(contentType);
    }

    private getThingDescriptionPayload() {
        return Helpers.getAddresses().flatMap((address) =>
            Array.from(this.things.keys()).map(
                (thingKey) =>
                    `${this.scheme}://${Helpers.toUriLiteral(address)}:${this.getPort()}/${encodeURIComponent(
                        thingKey
                    )}`
            )
        );
    }

    private parseUriSegments(requestUri: string) {
        const segments = decodeURI(requestUri).split("/");

        return {
            thingKey: segments[1],
            affordanceType: segments[2],
            affordanceKey: segments[3],
        };
    }

    private sendContentResponse(res: OutgoingMessage, payload: Buffer | string, contentType: string) {
        res.setOption("Content-Format", contentType);
        this.sendResponse(res, "2.05", payload);
    }

    private sendChangedResponse(res: OutgoingMessage, payload?: Buffer | string) {
        this.sendResponse(res, "2.04", payload);
    }

    // TODO: The name of this method might not be ideal yet.
    private streamContentResponse(res: OutgoingMessage, content: Content, options?: { end?: boolean | undefined }) {
        res.setOption("Content-Format", content.type);
        res.code = "2.05";
        content.body.pipe(res, options);
    }

    private sendNotFoundResponse(res: OutgoingMessage) {
        this.sendResponse(res, "4.04", "Not Found");
    }

    private sendMethodNotAllowedResponse(res: OutgoingMessage) {
        this.sendResponse(res, "4.05", "Method Not Allowed");
    }

    private sendResponse(res: OutgoingMessage, responseCode: string, payload?: string | Buffer) {
        res.code = responseCode;
        res.end(payload);
    }

    private formatRequestOrigin(req: IncomingMessage) {
        const originAddress = req.rsinfo.address;
        const originPort = req.rsinfo.port;
        return `${Helpers.toUriLiteral(originAddress)}:${originPort}`;
    }

    private isEmpty(object: Record<string, unknown>) {
        return Object.keys(object).length === 0;
    }
}

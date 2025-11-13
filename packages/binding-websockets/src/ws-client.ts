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
 * WebSockets client
 */

import { ProtocolClient, Content, Form, SecurityScheme, createLoggers } from "@node-wot/core";
import { Subscription } from "rxjs/Subscription";
import WebSocket from "ws";
import { Readable } from "stream";

const { debug, info, warn, error } = createLoggers("binding-websockets", "ws-client");

/**
 * Protocol mode for WebSocket communication
 */
type ProtocolMode = "wot" | "generic";

/**
 * Handler for pending request responses
 */
interface ResponseHandler {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timeoutId: NodeJS.Timeout;
}

/**
 * Handlers for active subscriptions
 */
interface SubscriptionHandlers {
    next: (content: Content) => void;
    error?: (error: Error) => void;
    complete?: () => void;
}

/**
 * Stored security credentials
 */
interface StoredCredentials {
    scheme: string;
    token?: string;
    username?: string;
    password?: string;
    [key: string]: unknown;
}

export default class WebSocketClient implements ProtocolClient {
    // Connection management
    private connections: Map<string, WebSocket> = new Map();
    private pendingRequests: Map<string, ResponseHandler> = new Map();
    private subscriptions: Map<string, Set<SubscriptionHandlers>> = new Map();
    private credentials: Map<string, StoredCredentials> = new Map();
    private protocolMode: Map<string, ProtocolMode> = new Map();
    private isStarted = false;

    // Configuration
    private readonly defaultTimeout = 5000;

    constructor() {
        debug("WebSocketClient created");
    }

    public toString(): string {
        return `[WebSocketClient]`;
    }

    public async readResource(form: Form): Promise<Content> {
        debug(`readResource: ${form.href}`);

        const ws = await this.getOrCreateConnection(form);
        const baseUrl = this.extractBaseUrl(form.href);
        const mode = this.protocolMode.get(baseUrl) ?? "generic";

        let response: unknown;

        if (mode === "wot") {
            // Use W3C Web Thing Protocol
            const thingId = this.extractThingId(form.href);
            const resourceName = this.extractResourceName(form.href);
            const request = this.buildWoTRequest("readproperty", thingId, resourceName);
            response = await this.sendRequest(ws, request);

            // Extract value from W3C response
            const value = (response as Record<string, unknown>).value !== undefined ? (response as Record<string, unknown>).value : response;
            return new Content(
                form.contentType ?? "application/json",
                this.bufferToStream(Buffer.from(JSON.stringify(value)))
            );
        } else {
            // Generic WebSocket: send simple request
            const request = {
                id: this.generateMessageId(),
                action: "read",
                href: form.href,
            };
            response = await this.sendRequest(ws, request);
            return new Content(
                form.contentType ?? "application/json",
                this.bufferToStream(Buffer.from(JSON.stringify(response)))
            );
        }
    }

    public async writeResource(form: Form, content: Content): Promise<void> {
        debug(`writeResource: ${form.href}`);

        const ws = await this.getOrCreateConnection(form);
        const baseUrl = this.extractBaseUrl(form.href);
        const mode = this.protocolMode.get(baseUrl) ?? "generic";

        // Parse content body
        const buffer = await content.toBuffer();
        const data = JSON.parse(buffer.toString());

        if (mode === "wot") {
            // Use W3C Web Thing Protocol
            const thingId = this.extractThingId(form.href);
            const resourceName = this.extractResourceName(form.href);
            const request = this.buildWoTRequest("writeproperty", thingId, resourceName, data);
            await this.sendRequest(ws, request);
        } else {
            // Generic WebSocket
            const request = {
                id: this.generateMessageId(),
                action: "write",
                href: form.href,
                value: data,
            };
            await this.sendRequest(ws, request);
        }
    }

    public async invokeResource(form: Form, content?: Content): Promise<Content> {
        debug(`invokeResource: ${form.href}`);

        const ws = await this.getOrCreateConnection(form);
        const baseUrl = this.extractBaseUrl(form.href);
        const mode = this.protocolMode.get(baseUrl) ?? "generic";

        // Parse input parameters if provided
        let inputData: unknown;
        if (content != null) {
            const buffer = await content.toBuffer();
            inputData = JSON.parse(buffer.toString());
        }

        let response: unknown;

        if (mode === "wot") {
            // Use W3C Web Thing Protocol
            const thingId = this.extractThingId(form.href);
            const resourceName = this.extractResourceName(form.href);
            const request = this.buildWoTRequest("invokeaction", thingId, resourceName, inputData);
            response = await this.sendRequest(ws, request);

            // Extract output from W3C response
            const output = (response as Record<string, unknown>).output !== undefined ? (response as Record<string, unknown>).output : response;
            return new Content(
                form.response?.contentType ?? form.contentType ?? "application/json",
                this.bufferToStream(Buffer.from(JSON.stringify(output)))
            );
        } else {
            // Generic WebSocket
            const request = {
                id: this.generateMessageId(),
                action: "invoke",
                href: form.href,
                input: inputData,
            };
            response = await this.sendRequest(ws, request);
            return new Content(
                form.response?.contentType ?? form.contentType ?? "application/json",
                this.bufferToStream(Buffer.from(JSON.stringify(response)))
            );
        }
    }

    public async unlinkResource(form: Form): Promise<void> {
        debug(`unlinkResource: ${form.href}`);

        const baseUrl = this.extractBaseUrl(form.href);
        const resourceKey = `${baseUrl}:${this.extractResourceName(form.href)}`;

        // Remove subscription handlers
        this.subscriptions.delete(resourceKey);

        const ws = await this.getOrCreateConnection(form);
        const mode = this.protocolMode.get(baseUrl) ?? "generic";

        if (mode === "wot") {
            // Send unsubscribe request
            const thingId = this.extractThingId(form.href);
            const resourceName = this.extractResourceName(form.href);
            const request = {
                messageType: "request",
                thingID: thingId,
                messageID: this.generateMessageId(),
                operation: "unsubscribe",
                name: resourceName,
            };

            try {
                await this.sendRequest(ws, request);
            } catch (err) {
                // Ignore errors during unsubscribe
                debug(`Unsubscribe error (ignored): ${err}`);
            }
        }
    }

    public async subscribeResource(
        form: Form,
        next: (content: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        debug(`subscribeResource: ${form.href}`);

        const ws = await this.getOrCreateConnection(form);
        const baseUrl = this.extractBaseUrl(form.href);
        const resourceName = this.extractResourceName(form.href);
        const resourceKey = `${baseUrl}:${resourceName}`;
        const mode = this.protocolMode.get(baseUrl) ?? "generic";

        // Store subscription handlers
        if (!this.subscriptions.has(resourceKey)) {
            this.subscriptions.set(resourceKey, new Set());
        }
        const handlers: SubscriptionHandlers = { next, error, complete };
        this.subscriptions.get(resourceKey)!.add(handlers);

        // Determine if this is an event or property subscription
        const isEvent = form.op?.includes("subscribeevent") ?? form.op === "subscribeevent";

        if (mode === "wot") {
            // Send W3C Web Thing Protocol subscribe request
            const thingId = this.extractThingId(form.href);
            const operation = isEvent ? "subscribeevent" : "subscribeproperty";
            const request = {
                messageType: "request",
                thingID: thingId,
                messageID: this.generateMessageId(),
                operation: operation,
                name: resourceName,
            };

            try {
                await this.sendRequest(ws, request);
            } catch (err) {
                // Remove handler if subscription failed
                this.subscriptions.get(resourceKey)?.delete(handlers);
                throw err;
            }
        }

        // Return RxJS Subscription with unsubscribe function
        return new Subscription(() => {
            const subs = this.subscriptions.get(resourceKey);
            if (subs != null) {
                subs.delete(handlers);
                if (subs.size === 0) {
                    this.subscriptions.delete(resourceKey);
                    // Attempt to unlink
                    this.unlinkResource(form).catch((err) => {
                        debug(`Error unlinking during unsubscribe: ${err}`);
                    });
                }
            }
        });
    }

    /**
     * @inheritdoc
     */
    public async requestThingDescription(uri: string): Promise<Content> {
        throw new Error("Method not implemented");
    }

    public async start(): Promise<void> {
        if (this.isStarted) {
            warn("WebSocketClient already started");
            return;
        }
        info("WebSocketClient starting");
        this.isStarted = true;
    }

    public async stop(): Promise<void> {
        if (!this.isStarted) {
            warn("WebSocketClient not started");
            return;
        }

        info("WebSocketClient stopping");

        // Close all connections
        for (const [url, ws] of this.connections.entries()) {
            debug(`Closing WebSocket connection to ${url}`);
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        }
        this.connections.clear();

        // Reject all pending requests
        for (const [, handler] of this.pendingRequests.entries()) {
            clearTimeout(handler.timeoutId);
            handler.reject(new Error("WebSocketClient stopped"));
        }
        this.pendingRequests.clear();

        // Clear subscriptions
        this.subscriptions.clear();

        // Clear credentials and protocol modes
        this.credentials.clear();
        this.protocolMode.clear();

        this.isStarted = false;
        info("WebSocketClient stopped");
    }

    public setSecurity(metadata: Array<SecurityScheme>, credentials?: unknown): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            warn("WebSocketClient received empty security metadata");
            return false;
        }

        // Support multiple security schemes by storing all
        for (const security of metadata) {
            debug(`WebSocketClient processing security scheme '${security.scheme}'`);

            const stored: StoredCredentials = {
                scheme: security.scheme,
            };

            // Extract credentials based on scheme type
            if (security.scheme === "bearer" && credentials != null) {
                const creds = credentials as Record<string, unknown>;
                stored.token = (creds.token ?? creds.bearer ?? creds) as string;
                debug("Stored Bearer token for authentication");
            } else if (security.scheme === "oauth2" && credentials != null) {
                const creds = credentials as Record<string, unknown>;
                stored.token = (creds.token ?? creds.access_token) as string;
                debug("Stored OAuth2 token for authentication");
            } else if (security.scheme === "basic" && credentials != null) {
                const creds = credentials as Record<string, unknown>;
                stored.username = (creds.username ?? creds.user) as string;
                stored.password = (creds.password ?? creds.pass) as string;
                debug("Stored Basic auth credentials");
            }

            // Store by security scheme name or use default key
            const key = (security as Record<string, unknown>).name ?? "default";
            this.credentials.set(key as string, stored);
        }

        return true;
    }

    /**
     * Generate unique message ID for request/response correlation
     */
    private generateMessageId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Convert Buffer to Readable stream
     */
    private bufferToStream(buffer: Buffer): Readable {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    /**
     * Extract base URL (ws://host:port) from form href
     */
    private extractBaseUrl(href: string): string {
        const url = new URL(href);
        return `${url.protocol}//${url.host}`;
    }

    /**
     * Extract resource name from form href path
     * Example: ws://host/thing/properties/temp -> temp
     */
    private extractResourceName(href: string): string {
        const url = new URL(href);
        const parts = url.pathname.split("/").filter((p) => p.length > 0);
        return parts.length > 0 ? parts[parts.length - 1] : "";
    }

    /**
     * Extract Thing ID from form href
     * For W3C Web Thing Protocol compatibility
     */
    private extractThingId(href: string): string {
        const url = new URL(href);
        // Extract thing ID from path (typically after /things/)
        const parts = url.pathname.split("/").filter((p) => p.length > 0);
        const thingIndex = parts.findIndex((p) => p === "things" || p === "thing");
        if (thingIndex >= 0 && thingIndex < parts.length - 1) {
            return parts[thingIndex + 1];
        }
        // Fallback: use host as thing ID
        return url.host;
    }

    /**
     * Extract WebSocket subprotocol from form if specified
     */
    private extractSubprotocol(form: Form): string | undefined {
        // Check various possible locations for subprotocol
        if (form.subprotocol != null) {
            return form.subprotocol;
        }
        if (form["wss:subprotocol"] != null) {
            return form["wss:subprotocol"] as string;
        }
        if (form["ws:subprotocol"] != null) {
            return form["ws:subprotocol"] as string;
        }
        return undefined;
    }

    /**
     * Detect protocol mode from form hints
     * Returns 'wot' for W3C Web Thing Protocol, 'generic' otherwise
     */
    private detectProtocolMode(form: Form): ProtocolMode {
        // Check for explicit protocol hint
        if (form["wot:protocol"] === "webthing") {
            return "wot";
        }

        // Check if subprotocol indicates Web Thing Protocol
        const subprotocol = this.extractSubprotocol(form);
        if (subprotocol === "webthingprotocol" || subprotocol === "webthing") {
            return "wot";
        }

        // Check for other hints in form
        if (form["@type"] === "WebThing" || form.type === "WebThing") {
            return "wot";
        }

        // Default to generic WebSocket protocol
        return "generic";
    }

    /**
     * Build W3C Web Thing Protocol request message
     */
    private buildWoTRequest(
        operation: string,
        thingId: string,
        resourceName: string,
        data?: unknown
    ): Record<string, unknown> {
        const request: Record<string, unknown> = {
            messageType: "request",
            thingID: thingId,
            messageID: this.generateMessageId(),
            operation: operation,
            name: resourceName,
        };

        // Add data based on operation type
        if (data !== undefined) {
            if (operation === "writeproperty") {
                request.value = data;
            } else if (operation === "invokeaction") {
                request.input = data;
            } else {
                request.data = data;
            }
        }

        return request;
    }

    /**
     * Get or create WebSocket connection for the given form
     */
    private async getOrCreateConnection(form: Form): Promise<WebSocket> {
        const baseUrl = this.extractBaseUrl(form.href);

        // Check if connection already exists and is open
        const existing = this.connections.get(baseUrl);
        if (existing != null && existing.readyState === WebSocket.OPEN) {
            return existing;
        }

        // Detect protocol mode
        const mode = this.detectProtocolMode(form);
        this.protocolMode.set(baseUrl, mode);
        debug(`Using protocol mode '${mode}' for ${baseUrl}`);

        // Create new WebSocket connection
        return new Promise((resolve, reject) => {
            const wsOptions: WebSocket.ClientOptions = {};

            // Add authentication headers if credentials available
            const creds = this.credentials.get("default");
            if (creds != null && creds.token != null) {
                wsOptions.headers = {
                    Authorization: `Bearer ${creds.token}`,
                };
                debug(`Adding Bearer token to WebSocket connection`);
            } else if (creds != null && creds.username != null && creds.password != null) {
                const auth = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
                wsOptions.headers = {
                    Authorization: `Basic ${auth}`,
                };
                debug(`Adding Basic auth to WebSocket connection`);
            }

            // Extract subprotocol if specified
            const subprotocol = this.extractSubprotocol(form);
            const protocols = subprotocol ? [subprotocol] : undefined;

            debug(`Creating WebSocket connection to ${baseUrl}${protocols ? ` with subprotocol ${subprotocol}` : ""}`);

            const ws = new WebSocket(baseUrl, protocols, wsOptions);

            ws.on("open", () => {
                info(`WebSocket connection established to ${baseUrl}`);
                this.connections.set(baseUrl, ws);
                resolve(ws);
            });

            ws.on("message", (data: WebSocket.Data) => {
                this.handleWebSocketMessage(baseUrl, data);
            });

            ws.on("error", (err: Error) => {
                error(`WebSocket error for ${baseUrl}: ${err.message}`);
                // Reject pending requests
                for (const [messageId, handler] of this.pendingRequests.entries()) {
                    handler.reject(err);
                    clearTimeout(handler.timeoutId);
                    this.pendingRequests.delete(messageId);
                }
                // Notify subscriptions
                const subs = this.subscriptions.get(baseUrl);
                if (subs != null) {
                    subs.forEach((handlers) => {
                        if (handlers.error != null) {
                            handlers.error(err);
                        }
                    });
                }
                reject(err);
            });

            ws.on("close", (code: number, reason: string) => {
                info(`WebSocket connection closed for ${baseUrl}: ${code} ${reason}`);
                this.connections.delete(baseUrl);
                // Complete subscriptions
                const subs = this.subscriptions.get(baseUrl);
                if (subs != null) {
                    subs.forEach((handlers) => {
                        if (handlers.complete != null) {
                            handlers.complete();
                        }
                    });
                    this.subscriptions.delete(baseUrl);
                }
            });

            // Connection timeout
            setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                    reject(new Error(`WebSocket connection timeout for ${baseUrl}`));
                }
            }, this.defaultTimeout);
        });
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleWebSocketMessage(baseUrl: string, data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            const mode = this.protocolMode.get(baseUrl) ?? "generic";

            if (mode === "wot") {
                this.handleWoTMessage(baseUrl, message);
            } else {
                this.handleGenericMessage(baseUrl, message);
            }
        } catch (err) {
            error(`Failed to parse WebSocket message: ${err}`);
        }
    }

    /**
     * Handle W3C Web Thing Protocol message
     */
    private handleWoTMessage(baseUrl: string, message: Record<string, unknown>): void {
        const messageType = message.messageType;

        if (messageType === "response" && message.correlationID != null) {
            // Handle request/response correlation
            const handler = this.pendingRequests.get(message.correlationID as string);
            if (handler != null) {
                clearTimeout(handler.timeoutId);
                this.pendingRequests.delete(message.correlationID as string);

                if (message.error != null) {
                    const errorMsg = (message.error as Record<string, unknown>).message;
                    handler.reject(new Error((errorMsg ?? "Request failed") as string));
                } else {
                    handler.resolve(message);
                }
            }
        } else if (messageType === "event" || messageType === "propertyUpdate") {
            // Handle subscription notifications
            const resourceKey = `${baseUrl}:${message.name as string}`;
            const subs = this.subscriptions.get(resourceKey);
            if (subs != null) {
                const value = message.data !== undefined ? message.data : message.value;
                const content = new Content(
                    "application/json",
                    this.bufferToStream(Buffer.from(JSON.stringify(value)))
                );
                subs.forEach((handlers) => {
                    try {
                        handlers.next(content);
                    } catch (err) {
                        error(`Error in subscription handler: ${err}`);
                    }
                });
            }
        }
    }

    /**
     * Handle generic WebSocket message (non-WoT protocol)
     */
    private handleGenericMessage(baseUrl: string, message: Record<string, unknown>): void {
        // For generic protocol, try to correlate by any ID field
        const possibleIds = [message.id, message.messageId, message.requestId];

        for (const id of possibleIds) {
            if (id != null) {
                const handler = this.pendingRequests.get(id as string);
                if (handler != null) {
                    clearTimeout(handler.timeoutId);
                    this.pendingRequests.delete(id as string);
                    handler.resolve(message);
                    return;
                }
            }
        }

        // If no correlation found, might be a subscription update
        // Notify all subscriptions for this base URL
        const subs = this.subscriptions.get(baseUrl);
        if (subs != null) {
            const content = new Content(
                "application/json",
                this.bufferToStream(Buffer.from(JSON.stringify(message)))
            );
            subs.forEach((handlers) => {
                try {
                    handlers.next(content);
                } catch (err) {
                    error(`Error in subscription handler: ${err}`);
                }
            });
        }
    }

    /**
     * Send request and wait for response with timeout
     */
    private async sendRequest(
        ws: WebSocket,
        request: Record<string, unknown>,
        timeout: number = this.defaultTimeout
    ): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const messageId = (request.messageID ?? request.id) as string;

            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(messageId);
                reject(new Error(`Request timeout after ${timeout}ms`));
            }, timeout);

            this.pendingRequests.set(messageId, {
                resolve,
                reject,
                timeoutId,
            });

            const payload = JSON.stringify(request);
            debug(`Sending WebSocket request: ${payload}`);
            ws.send(payload, (err) => {
                if (err != null) {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(messageId);
                    reject(err);
                }
            });
        });
    }
}

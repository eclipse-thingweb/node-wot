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

import { Subscription } from "rxjs/Subscription";
import { Readable } from "stream";
import { URL } from "url";
import {
    ProtocolClient,
    Content,
    ContentSerdes,
    Form,
    SecurityScheme,
    createLoggers,
    AllOfSecurityScheme,
    OneOfSecurityScheme,
} from "@node-wot/core";

import {
    ClientSession,
    ClientSubscription,
    OPCUAClient,
    ReadValueIdOptions,
    MonitoringParametersOptions,
    ClientMonitoredItem,
    DataValue,
    TimestampsToReturn,
    MonitoringMode,
    VariantLike,
    DataType,
    IBasicSession,
    VariantArrayType,
    Variant,
    VariantOptions,
    SecurityPolicy,
} from "node-opcua-client";
import {
    AnonymousIdentity,
    ArgumentDefinition,
    findBasicDataType,
    getBuiltInDataType,
    readNamespaceArray,
    UserIdentityInfo,
} from "node-opcua-pseudo-session";
import { NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { AttributeIds } from "node-opcua-data-model";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { coercePrivateKeyPem, readPrivateKey } from "node-opcua-crypto";
import { opcuaJsonEncodeVariant } from "node-opcua-json";
import { Argument, MessageSecurityMode, UserTokenType } from "node-opcua-types";
import { isGoodish2 } from "node-opcua";

import { schemaDataValue } from "./codec";
import { OPCUACAuthenticationScheme, OPCUAChannelSecurityScheme } from "./security-scheme";
import { CertificateManagerSingleton } from "./certificate-manager-singleton";
import { resolveChannelSecurity, resolvedUserIdentity } from "./opcua-security-resolver";
import { findMostSecureChannel } from "./find-most-secure-channel";

const { debug } = createLoggers("binding-opcua", "opcua-protocol-client");

export type Command = "Read" | "Write" | "Subscribe";

export interface NodeByBrowsePath {
    root: NodeIdLike;
    path: string;
}
export type NodeIdLike2 = NodeIdLike & {
    root: undefined;
    path: undefined;
};

export interface FormPartialNodeDescription {
    /** @deprecated use href instead */
    "opcua:nodeId"?: NodeIdLike | NodeByBrowsePath;
}

export interface OPCUAForm extends Form, FormPartialNodeDescription {}

interface OPCUAConnection {
    session: ClientSession;
    client: OPCUAClient;
    subscription: ClientSubscription;
    namespaceArray?: string[];
}

function _variantToJSON(variant: Variant, contentType: string) {
    contentType = contentType.split(";")[0];

    switch (contentType) {
        case "application/opcua+json": {
            return opcuaJsonEncodeVariant(variant, true);
        }
        case "application/json": {
            return opcuaJsonEncodeVariant(variant, false);
        }
        default: {
            throw new Error("Unsupported content type here : " + contentType);
        }
    }
}

export class OPCUAProtocolClient implements ProtocolClient {
    private _connections = new Map<string, Promise<OPCUAConnection>>();

    private _securityMode: MessageSecurityMode = MessageSecurityMode.None;
    private _securityPolicy: SecurityPolicy = SecurityPolicy.None;
    private _useAutoChannel: boolean = false;
    private _userIdentity: UserIdentityInfo = <AnonymousIdentity>{ type: UserTokenType.Anonymous };

    /**
     * return the number of active connections to an OPCUA Server
     */
    public get connectionCount() {
        return this._connections.size;
    }
    private async _createConnection(endpoint: string): Promise<OPCUAConnection> {
        debug(`_createConnection: creating new connection to ${endpoint}`);

        const clientCertificateManager = await CertificateManagerSingleton.getCertificateManager();

        let securityMode = this._securityMode;
        let securityPolicy = this._securityPolicy;

        if (this._useAutoChannel) {
            if (securityMode === MessageSecurityMode.Invalid) {
                const mostSecure = await findMostSecureChannel(endpoint);
                securityMode = mostSecure.messageSecurityMode;
                securityPolicy = mostSecure.securityPolicy;
                debug(
                    `_createConnection: auto-selected security mode ${MessageSecurityMode[securityMode]} with policy ${securityPolicy}`
                );
            }
        }

        const client = OPCUAClient.create({
            endpointMustExist: false,
            connectionStrategy: {
                maxRetry: 1,
            },
            securityMode,
            securityPolicy,
            clientCertificateManager,
        });

        client.on("backoff", () => {
            debug(`connection:backoff: cannot connect to ${endpoint}`);
        });

        try {
            await client.connect(endpoint);
            debug(`_createConnection: client connected to ${endpoint}`);

            // adjust with private key
            if (this._userIdentity.type === UserTokenType.Certificate && !this._userIdentity.privateKey) {
                const internalKey = readPrivateKey(client.clientCertificateManager.privateKey);
                const privateKeyPem = coercePrivateKeyPem(internalKey);
                this._userIdentity.privateKey = privateKeyPem;
            }
            const session = await client.createSession(this._userIdentity);
            debug(`_createConnection: session created for ${endpoint}`);

            const subscription = await session.createSubscription2({
                maxNotificationsPerPublish: 100,
                publishingEnabled: true,
                requestedLifetimeCount: 100,
                requestedPublishingInterval: 250,
                requestedMaxKeepAliveCount: 10,
                priority: 1,
            });
            debug(`_createConnection: subscription created for ${endpoint}`);

            return { client, session, subscription };
        } catch (err) {
            // Make sure to disconnect if any post-connection step fails
            await client.disconnect();
            const errMessage = `Failed to establish a full connection to ${endpoint}: ${(err as Error).message}`;
            debug(errMessage);
            throw new Error(errMessage);
        }
    }

    private async _withConnection<T>(form: OPCUAForm, next: (connection: OPCUAConnection) => Promise<T>): Promise<T> {
        const href = form.href;
        if (!href) {
            const err = new Error("Invalid OPCUA endpoint: href is missing in form");
            debug(err.message);
            throw err;
        }

        // Use modern URL API and ensure path is included for endpoint uniqueness
        let endpoint: string;
        try {
            const parsedUrl = new URL(href);
            if (parsedUrl.protocol !== "opc.tcp:") {
                throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
            }
            // We use the full href as the canonical endpoint identifier, without the query and fragment
            parsedUrl.hash = "";
            parsedUrl.search = "";
            endpoint = parsedUrl.href;
        } catch (err) {
            debug(`Invalid OPCUA endpoint href: ${href}. Error: ${(err as Error).message}`);
            throw new Error(`Invalid OPCUA endpoint: ${href}`);
        }

        let connectionPromise = this._connections.get(endpoint);

        if (!connectionPromise) {
            debug(`_withConnection: no cached connection for ${endpoint}. Creating a new one.`);
            connectionPromise = this._createConnection(endpoint);
            this._connections.set(endpoint, connectionPromise);

            // If the connection fails, remove the rejected promise from the cache
            // to allow future retries.
            connectionPromise.catch((err) => {
                debug(`_withConnection: connection to ${endpoint} failed. Evicting from cache. Error: ${err.message}`);
                if (this._connections.get(endpoint) === connectionPromise) {
                    this._connections.delete(endpoint);
                }
            });
        } else {
            debug(`_withConnection: using cached connection promise for ${endpoint}`);
        }

        const connection = await connectionPromise;
        return next(connection);
    }

    private async _withSession<T>(form: OPCUAForm, next: (session: ClientSession) => Promise<T>): Promise<T> {
        return this._withConnection<T>(form, async (c: OPCUAConnection) => {
            return next(c.session);
        });
    }

    private async _getNamespaceArray(form: OPCUAForm): Promise<string[]> {
        return this._withConnection(form, async (c: OPCUAConnection) => {
            if (!c.namespaceArray) {
                c.namespaceArray = await readNamespaceArray(c.session);
            }
            return c.namespaceArray;
        });
    }

    private async _withSubscription<T>(
        form: OPCUAForm,
        next: (session: ClientSession, subscription: ClientSubscription) => Promise<T>
    ): Promise<T> {
        return this._withConnection<T>(form, async (c: OPCUAConnection) => {
            return next(c.session, c.subscription);
        });
    }

    private async _resolveNodeId3(form: OPCUAForm, nodeId: NodeIdLike): Promise<NodeId> {
        const namespaceArray = await this._getNamespaceArray(form);
        return resolveNodeId(nodeId, { namespaceArray });
    }

    private async _resolveNodeId2(form: OPCUAForm, fNodeId: NodeIdLike | NodeByBrowsePath): Promise<NodeId> {
        if (fNodeId instanceof NodeId) {
            return fNodeId;
        } else if ((<NodeByBrowsePath>fNodeId).root != null) {
            const f = <NodeByBrowsePath>fNodeId;
            const r: NodeIdLike = f.root;
            const rootNodeId = await this._resolveNodeId3(form, r);
            const nodeId = this._withSession<NodeId>(form, async (session) => {
                const path = makeBrowsePath(rootNodeId, f.path);
                const result = await session.translateBrowsePath(path);
                if (result.statusCode !== StatusCodes.Good || !result.targets) {
                    debug(`resolveNodeId: failed to extract  ${f.path}`);
                    throw new Error(`cannot resolve nodeId from path
                    root       =${f.root}
                    path       =${f.path}
                    statusCode =${result.statusCode.toString()}`);
                }
                return result.targets[0].targetId;
            });
            return nodeId;
        } else {
            return await this._resolveNodeId3(form, fNodeId as NodeIdLike);
        }
    }

    static getNodeId(form: OPCUAForm): NodeIdLike | NodeByBrowsePath {
        let fNodeId;
        if (form.href != null && form.href !== "" && form.href !== "/") {
            // parse node id from href
            // Note: href needs to be absolute
            const url = new URL(form.href);
            if (url != null && url.search != null && url.search.startsWith("?")) {
                const searchParams = new URLSearchParams(url.search.substring(1));
                fNodeId = searchParams.get("id");
            }
        }
        if (fNodeId == null) {
            // fallback to *old* way
            fNodeId = form["opcua:nodeId"];
            if (fNodeId == null) {
                debug(`resolveNodeId: form = ${form}`);
                throw new Error("form must expose nodeId via href or 'opcua:nodeId'");
            }
        }
        return fNodeId;
    }

    private async _resolveNodeId(form: OPCUAForm): Promise<NodeId> {
        const fNodeId = OPCUAProtocolClient.getNodeId(form);
        return this._resolveNodeId2(form, fNodeId);
    }

    /** extract the dataType of a variable */
    private async _predictDataType(form: OPCUAForm): Promise<DataType> {
        const nodeId = await this._resolveNodeId(form);

        return await this._withSession<DataType>(form, async (session) => {
            const dataTypeOrNull = await getBuiltInDataType(session, nodeId);
            if (dataTypeOrNull !== undefined && dataTypeOrNull !== DataType.Null) {
                return dataTypeOrNull;
            }
            throw new Error("cannot predict dataType for nodeId " + nodeId.toString());
        });
    }

    private async _resolveMethodNodeId(form: OPCUAForm): Promise<NodeId> {
        //  const objectNode = this._resolveNodeId(form);
        const fNodeId = form["opcua:method"];
        if (fNodeId == null) {
            debug(`resolveNodeId: form = ${form}`);
            throw new Error("form must expose a 'opcua:method'");
        }
        return this._resolveNodeId2(form, fNodeId as NodeIdLike | NodeByBrowsePath);
    }

    public async readResource(form: OPCUAForm): Promise<Content> {
        debug(`readResource: reading ${form}`);

        const content = await this._withSession(form, async (session) => {
            const nodeId = await this._resolveNodeId(form);
            const dataValue = await session.read({
                nodeId,
                attributeId: AttributeIds.Value,
            });
            return this._dataValueToContent(form, dataValue);
        });
        debug(`readResource: contentType ${content.type}`);
        return content;
    }

    public async writeResource(form: OPCUAForm, content: Content): Promise<void> {
        const statusCode = await this._withSession(form, async (session) => {
            const nodeId = await this._resolveNodeId(form);
            const dataValue = await this._contentToDataValue(form, content);
            const statusCode = await session.write({
                nodeId,
                attributeId: AttributeIds.Value,
                value: dataValue,
            });
            return statusCode;
        });
        debug(`writeResource: statusCode ${statusCode}`);
        if (statusCode !== StatusCodes.Good && !isGoodish2(statusCode, { treatUncertainAsBad: false })) {
            throw new Error("Error in OPCUA Write : " + statusCode.toString());
        }
    }

    public async invokeResource(form: OPCUAForm, content: Content): Promise<Content> {
        return await this._withSession(form, async (session) => {
            const objectId = await this._resolveNodeId(form);
            const methodId = await this._resolveMethodNodeId(form);

            const argumentDefinition: ArgumentDefinition = await session.getArgumentDefinition(methodId);

            const inputArguments = await this._resolveInputArguments(session, form, content, argumentDefinition);

            const callResult = await session.call({
                objectId,
                methodId,
                inputArguments,
            });
            // Shall we throw an exception if call failed ?
            if (callResult.statusCode !== StatusCodes.Good) {
                throw new Error("Error in Calling OPCUA Method : " + callResult.statusCode.toString());
            }
            const output = await this._resolveOutputArguments(
                session,
                form,
                argumentDefinition,
                callResult.outputArguments ?? []
            );
            return output;
        });
    }

    public subscribeResource(
        form: OPCUAForm,
        next: (content: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        debug(`subscribeResource: form ${OPCUAProtocolClient.getNodeId(form)}`);

        return this._withSubscription<Subscription>(form, async (session, subscription) => {
            const nodeId = await this._resolveNodeId(form);
            const key = nodeId.toString();

            if (this._monitoredItems.has(key)) {
                // what to do if we are already subscribed ?
                const m = this._monitoredItems.get(key);
                m?.handlers.push(next);
                if (complete) {
                    complete();
                    complete = undefined;
                }
                return new Subscription(async () => {
                    await this._unmonitor(nodeId);
                });
            }

            const itemToMonitor: ReadValueIdOptions = {
                nodeId,
                attributeId: AttributeIds.Value,
            };
            const parameters: MonitoringParametersOptions = {
                samplingInterval: 250,
                discardOldest: true,
                queueSize: 1,
            };

            const monitoredItem = await subscription.monitor(
                itemToMonitor,
                parameters,
                TimestampsToReturn.Both,
                MonitoringMode.Reporting
            );

            const m = {
                monitoredItem,
                handlers: [next],
            };
            this._monitoredItems.set(key, m);
            monitoredItem.on("changed", async (dataValue: DataValue) => {
                try {
                    const content = await this._dataValueToContent(form, dataValue);
                    m.handlers.forEach((n) => n(content));
                } catch (err) {
                    debug(`${nodeId}: ${dataValue}`);
                    if (error) {
                        error(new Error(JSON.stringify(err)));
                    }
                }
                if (complete) {
                    complete();
                    complete = undefined;
                }
            });
            monitoredItem.once("err", (err) => {
                error && error(err as Error);
            });
            return new Subscription(async () => {
                await this._unmonitor(nodeId);
            });
        });
    }

    private async _unmonitor(nodeId: NodeId) {
        const key = nodeId.toString();
        if (this._monitoredItems.has(key)) {
            const m = this._monitoredItems.get(key);
            this._monitoredItems.delete(key);
            await m?.monitoredItem.terminate();
        }
    }

    async unlinkResource(form: OPCUAForm): Promise<void> {
        debug(`unlinkResource: form ${OPCUAProtocolClient.getNodeId(form)}`);
        await this._withSubscription<void>(form, async (session, subscription) => {
            const nodeId = await this._resolveNodeId(form);
            await this._unmonitor(nodeId);
        });
    }

    /**
     * @inheritdoc
     */
    public async requestThingDescription(uri: string): Promise<Content> {
        throw new Error("Method not implemented");
    }

    start(): Promise<void> {
        debug("start: Sorry not implemented");
        throw new Error("Method not implemented.");
    }

    async stop(): Promise<void> {
        debug("stop");
        // Wait for all connection promises to resolve before trying to close them.
        const connections = await Promise.all(this._connections.values());
        for (const connection of connections) {
            try {
                await connection.subscription.terminate();
                await connection.session.close();
                await connection.client.disconnect();
            } catch (err) {
                debug(`Error while stopping a connection: ${(err as Error).message}`);
            }
        }
        this._connections.clear();
        await CertificateManagerSingleton.releaseCertificateManager();
    }

    #setChannelSecurity(security: OPCUAChannelSecurityScheme): boolean {
        const { messageSecurityMode, securityPolicy } = resolveChannelSecurity(security);
        this._securityMode = messageSecurityMode;
        this._securityPolicy = securityPolicy;
        this._useAutoChannel = false;
        return true;
    }

    #setAuthentication(security: OPCUACAuthenticationScheme): boolean {
        this._userIdentity = resolvedUserIdentity(security);
        return true;
    }

    setSecurity(securitySchemes: SecurityScheme[], credentials?: unknown): boolean {
        for (const securityScheme of securitySchemes) {
            let success = true;
            switch (securityScheme.scheme) {
                case "auto": {
                    //
                    // Security scheme = auto instruct the client to automatically
                    // determine the most secure channel to use based on server Endpoints.
                    //
                    this._useAutoChannel = true;
                    // Invalid + _useAutoChannel=true indicates that the
                    // Channel Security Settings need to be resolved at runtime
                    // based on server Endpoints.
                    this._securityMode = MessageSecurityMode.Invalid;
                    this._securityPolicy = SecurityPolicy.None;
                    success = true;
                    break;
                }
                case "uav:channel-security":
                    success = this.#setChannelSecurity(securityScheme as OPCUAChannelSecurityScheme);
                    break;
                case "uav:authentication":
                    success = this.#setAuthentication(securityScheme as OPCUACAuthenticationScheme);
                    break;
                case "combo": {
                    const combo = securityScheme as AllOfSecurityScheme | OneOfSecurityScheme;
                    if (combo.allOf !== undefined) {
                        success = this.setSecurity(combo.allOf, credentials);
                    } else if (combo.oneOf !== undefined) {
                        // pick the first one for now
                        // later we might use credentials to select the most appropriate one
                        success = this.setSecurity([combo.oneOf[0]], credentials);
                    } else {
                        success = false;
                    }
                    break;
                }
                default:
                    // not for us , ignored
                    break;
            }
            if (!success) return false;
        }
        return true;
    }

    private _monitoredItems: Map<
        string,
        {
            monitoredItem: ClientMonitoredItem;
            handlers: ((content: Content) => void | Promise<void>)[];
        }
    > = new Map();

    ///
    private async _dataValueToContent(form: OPCUAForm, dataValue: DataValue): Promise<Content> {
        const contentType = form.contentType ?? "application/json";

        // QUESTION: how can we extend the default contentSerDes.valueToContent for application/json,
        const contentSerDes = ContentSerdes.get();
        if (contentType === "application/json") {
            const variantInJson = opcuaJsonEncodeVariant(dataValue.value, false);
            const content = contentSerDes.valueToContent(variantInJson, schemaDataValue, contentType);
            return content;
        }
        const content = contentSerDes.valueToContent(dataValue, schemaDataValue, contentType);
        return content;
    }

    private async _contentToDataValue(form: OPCUAForm, content: Content): Promise<DataValue> {
        const content2: { type: string; body: Buffer } = {
            ...content,
            body: await content.toBuffer(),
        };

        const contentSerDes = ContentSerdes.get();

        const contentType = content2.type ? content2.type.split(";")[0] : "application/json";

        switch (contentType) {
            case "application/json": {
                const dataType = await this._predictDataType(form);
                const value = contentSerDes.contentToValue(content2, schemaDataValue);
                return new DataValue({ value: { dataType, value } });
            }
            case "application/opcua+json": {
                const fullContentType = content2.type + ";to=DataValue";
                const content3 = {
                    type: fullContentType,
                    body: content2.body,
                };
                const dataValue = contentSerDes.contentToValue(content3, schemaDataValue) as DataValue;
                if (!(dataValue instanceof DataValue)) {
                    contentSerDes.contentToValue(content2, schemaDataValue) as DataValue;
                    throw new Error("Internal Error, expecting a DataValue here ");
                }
                debug(`_contentToDataValue: write ${form}`);
                debug(
                    `_contentToDataValue: content ${{
                        ...content2,
                        body: content2.body.toString("ascii"),
                    }}`
                );

                return dataValue;
            }
            default: {
                throw new Error("Unsupported content type here : " + contentType);
            }
        }
    }

    private async _contentToVariant(
        contentType: undefined | string,
        body: Buffer,
        dataType: DataType
    ): Promise<Variant> {
        const contentSerDes = ContentSerdes.get();

        contentType = contentType?.split(";")[0] ?? "application/json";

        switch (contentType) {
            case "application/json": {
                const value = contentSerDes.contentToValue({ type: contentType, body }, schemaDataValue);
                return new Variant({ dataType, value });
            }
            case "application/opcua+json": {
                contentType += ";type=Variant;to=DataValue";
                const content2 = { type: contentType, body };
                const dataValue = contentSerDes.contentToValue(content2, schemaDataValue) as DataValue;
                if (!(dataValue instanceof DataValue)) {
                    throw new Error("Internal Error, expecting a DataValue here ");
                }
                const variant = dataValue.value;
                if (variant.dataType !== dataType) {
                    debug(`Unexpected dataType ${variant.dataType}`);
                }
                return variant;
            }
            default: {
                throw new Error("Unsupported content type here : " + contentType);
            }
        }
    }

    private async _findBasicDataType(session: IBasicSession, dataType: NodeId): Promise<DataType | undefined> {
        return await findBasicDataType(session, dataType);
    }

    private async _resolveInputArguments(
        session: IBasicSession,
        form: OPCUAForm,
        content: Content | undefined | null,
        argumentDefinition: ArgumentDefinition
    ): Promise<VariantOptions[]> {
        if (content?.body == null) {
            return [];
        }
        const content2 = { ...content, body: await content.toBuffer() };
        const bodyInput = JSON.parse(content2.body.toString());

        const inputArguments = (argumentDefinition.inputArguments ?? []) as unknown as Argument[];

        const variants: VariantLike[] = [];
        for (let index = 0; index < inputArguments.length; index++) {
            const argument = inputArguments[index];

            const { name, dataType, /* description, */ arrayDimensions, valueRank } = argument;

            if (bodyInput[name ?? "null"] === undefined) {
                throw new Error("missing value in bodyInput for argument " + name);
            }
            const basicDataType = await this._findBasicDataType(session, dataType);
            if (basicDataType === undefined) {
                throw new Error("basicDataType is undefined for dataType " + dataType);
            }

            const arrayType: VariantArrayType =
                valueRank === -1
                    ? VariantArrayType.Scalar
                    : valueRank === 1
                      ? VariantArrayType.Array
                      : VariantArrayType.Matrix;

            const n = (a: unknown) => Buffer.from(JSON.stringify(a));
            const v = await this._contentToVariant(content2.type, n(bodyInput[name ?? "null"]), basicDataType);

            variants.push({
                dataType: basicDataType,
                arrayType,
                dimensions: arrayType === VariantArrayType.Matrix ? arrayDimensions : undefined,
                value: v.value,
            });
        }
        return variants;
    }

    private async _resolveOutputArguments(
        session: IBasicSession,
        form: OPCUAForm,
        argumentDefinition: ArgumentDefinition,
        outputVariants: Variant[]
    ): Promise<Content> {
        const outputArguments = (argumentDefinition.outputArguments ?? []) as unknown as Argument[];

        const contentType = form.contentType ?? "application/json";

        const body: Record<string, unknown> = {};
        for (let index = 0; index < outputArguments.length; index++) {
            const argument = outputArguments[index];
            const { name } = argument;
            const element = _variantToJSON(outputVariants[index], contentType);
            body[name ?? "null"] = element;
        }

        return new Content("application/json", Readable.from(JSON.stringify(body)));
    }
}

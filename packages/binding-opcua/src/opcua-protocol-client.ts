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

import { Subscription } from "rxjs/Subscription";
import { promisify } from "util";
import { Readable } from "stream";

import { ProtocolClient, Content, ContentSerdes, createLoggers } from "@node-wot/core";
import { Form, SecurityScheme } from "@node-wot/td-tools";

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
} from "node-opcua-client";
import { ArgumentDefinition, getBuiltInDataType } from "node-opcua-pseudo-session";

import { makeNodeId, NodeId, NodeIdLike, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { AttributeIds, BrowseDirection, makeResultMask } from "node-opcua-data-model";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";

import { schemaDataValue } from "./codec";
import { FormElementProperty } from "wot-thing-description-types";
import { opcuaJsonEncodeVariant } from "node-opcua-json";
import { Argument, BrowseDescription, BrowseResult } from "node-opcua-types";
import { isGoodish2, ReferenceTypeIds } from "node-opcua";

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
    "opcua:nodeId": NodeIdLike | NodeByBrowsePath;
}

export interface OPCUAForm extends Form, FormPartialNodeDescription {}

export interface OPCUAFormElement extends FormElementProperty, FormPartialNodeDescription {}

export interface OPCUAFormInvoke extends OPCUAForm {
    "opcua:method": NodeIdLike | NodeByBrowsePath;
}
export interface OPCUAFormSubscribe extends OPCUAForm {
    "opcua:samplingInterval"?: number;
}

interface OPCUAConnection {
    session: ClientSession;
    client: OPCUAClient;
    subscription: ClientSubscription;
}

type Resolver = (...arg: [...unknown[]]) => void;

interface OPCUAConnectionEx extends OPCUAConnection {
    pending?: Resolver[];
}

export function findBasicDataTypeC(
    session: IBasicSession,
    dataTypeId: NodeId,
    callback: (err: Error | null, dataType?: DataType) => void
): void {
    const resultMask = makeResultMask("ReferenceType");

    if (dataTypeId.identifierType === NodeIdType.NUMERIC && Number(dataTypeId.value) <= 25) {
        // we have a well-known DataType
        callback(null, dataTypeId.value as DataType);
    } else {
        // let's browse for the SuperType of this object
        const nodeToBrowse = new BrowseDescription({
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: false,
            nodeId: dataTypeId,
            referenceTypeId: makeNodeId(ReferenceTypeIds.HasSubtype),
            resultMask,
        });

        session.browse(nodeToBrowse, (err: Error | null, browseResult?: BrowseResult) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }

            /* istanbul ignore next */
            if (!browseResult) {
                return callback(new Error("Internal Error"));
            }

            browseResult.references = browseResult.references ?? /* istanbul ignore next */ [];
            const baseDataType = browseResult.references[0].nodeId;
            return findBasicDataTypeC(session, baseDataType, callback);
        });
    }
}
const findBasicDataType: (session: IBasicSession, dataTypeId: NodeId) => Promise<DataType | undefined> =
    promisify(findBasicDataTypeC);

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
    private _connections: Map<string, OPCUAConnectionEx> = new Map<string, OPCUAConnectionEx>();

    private async _withConnection<T>(form: OPCUAForm, next: (connection: OPCUAConnection) => Promise<T>): Promise<T> {
        const endpoint = form.href;
        if (!endpoint || !endpoint.match(/^opc.tcp:\/\//)) {
            debug(`invalid opcua:endpoint ${endpoint} specified`);
            throw new Error("Invalid OPCUA endpoint " + endpoint);
        }
        let c: OPCUAConnectionEx | undefined = this._connections.get(endpoint);
        if (!c) {
            const client = OPCUAClient.create({
                endpointMustExist: false,
                connectionStrategy: {
                    maxRetry: 1,
                },
            });
            client.on("backoff", () => {
                debug(`connection:backoff: cannot connection to  ${endpoint}`);
            });

            c = {
                client,
                pending: [] as Resolver[],
            } as OPCUAConnectionEx; // but incomplete still

            this._connections.set(endpoint, c);
            try {
                await client.connect(endpoint);
                const session = await client.createSession();
                c.session = session;

                const subscription = await session.createSubscription2({
                    maxNotificationsPerPublish: 100,
                    publishingEnabled: true,
                    requestedLifetimeCount: 100,
                    requestedPublishingInterval: 250,
                    requestedMaxKeepAliveCount: 10,
                    priority: 1,
                });
                c.subscription = subscription;

                const p = c.pending;
                c.pending = undefined;
                p && p.forEach((t) => t());

                this._connections.set(endpoint, c);
            } catch (err) {
                throw new Error("Cannot connected to endpoint " + endpoint + "\nmsg = " + (<Error>err).message);
            }
        }
        if (c.pending) {
            await new Promise((resolve) => {
                c?.pending?.push(resolve);
            });
        }
        return next(c);
    }

    private async _withSession<T>(form: OPCUAForm, next: (session: ClientSession) => Promise<T>): Promise<T> {
        return this._withConnection<T>(form, async (c: OPCUAConnection) => {
            return next(c.session);
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

    private async _resolveNodeId2(form: OPCUAForm, fNodeId: NodeIdLike | NodeByBrowsePath): Promise<NodeId> {
        if (fNodeId instanceof NodeId) {
            return fNodeId;
        } else if ((<NodeByBrowsePath>fNodeId).root) {
            const f = <NodeByBrowsePath>fNodeId;
            const r: NodeIdLike = f.root;
            const rootNodeId = resolveNodeId(r);
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
            return resolveNodeId(fNodeId as NodeIdLike);
        }
    }

    private async _resolveNodeId(form: OPCUAForm): Promise<NodeId> {
        const fNodeId = form["opcua:nodeId"];
        if (!fNodeId) {
            debug(`resolveNodeId: form = ${form}`);
            throw new Error("form must expose a 'opcua:nodeId'");
        }
        return this._resolveNodeId2(form, fNodeId);
    }

    /** extract the dataType of a variable */
    private async _predictDataType(form: OPCUAForm): Promise<DataType> {
        const fNodeId = form["opcua:nodeId"];
        if (!fNodeId) {
            debug(`resolveNodeId: form = ${form}`);
            throw new Error("form must expose a 'opcua:nodeId'");
        }
        const nodeId = await this._resolveNodeId2(form, fNodeId);
        return await this._withSession<DataType>(form, async (session: IBasicSession) => {
            const dataTypeOrNull = await promisify(getBuiltInDataType)(session, nodeId);
            if (dataTypeOrNull !== null) {
                return dataTypeOrNull as DataType;
            }
            throw new Error("cannot predict dataType for nodeId " + nodeId.toString());
        });
    }

    private async _resolveMethodNodeId(form: OPCUAFormInvoke): Promise<NodeId> {
        //  const objectNode = this._resolveNodeId(form);
        const fNodeId = form["opcua:method"];
        if (!fNodeId) {
            debug(`resolveNodeId: form = ${form}`);
            throw new Error("form must expose a 'opcua:nodeId'");
        }
        return this._resolveNodeId2(form, fNodeId);
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

    public async invokeResource(form: OPCUAFormInvoke, content: Content): Promise<Content> {
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
        debug(`subscribeResource: form ${form["opcua:nodeId"]}`);

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
        debug(`unlinkResource: form ${form["opcua:nodeId"]}`);
        this._withSubscription<void>(form, async (session, subscription) => {
            const nodeId = await this._resolveNodeId(form);
            await this._unmonitor(nodeId);
        });
    }

    start(): Promise<void> {
        debug("start: Sorry not implemented");
        throw new Error("Method not implemented.");
    }

    async stop(): Promise<void> {
        debug("stop");
        for (const c of this._connections.values()) {
            await c.subscription.terminate();
            await c.session.close();
            await c.client.disconnect();
        }
    }

    setSecurity(metadata: SecurityScheme[], credentials?: unknown): boolean {
        return true;
        // throw new Error("Method not implemented.");
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

        contentType = contentType ? contentType.split(";")[0] : "application/json";

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
        form: OPCUAFormInvoke,
        content: Content | undefined | null,
        argumentDefinition: ArgumentDefinition
    ): Promise<VariantOptions[]> {
        if (!content || !content.body) {
            return [];
        }
        const content2 = { ...content, body: await content.toBuffer() };
        const bodyInput = JSON.parse(content2.body.toString());

        const inputArguments = (argumentDefinition.inputArguments || []) as unknown as Argument[];

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
        form: OPCUAFormInvoke,
        argumentDefinition: ArgumentDefinition,
        outputVariants: Variant[]
    ): Promise<Content> {
        const outputArguments = (argumentDefinition.outputArguments || []) as unknown as Argument[];

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

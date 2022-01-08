import { Subscription } from "rxjs/Subscription";
import { promisify } from "util";

import { ProtocolClient, Content, ContentSerdes, ProtocolHelpers } from "@node-wot/core";
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
} from "node-opcua-client";
import { ArgumentDefinition, getBuiltInDataType } from "node-opcua-pseudo-session";

import { makeNodeId, NodeId, NodeIdLike, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { AttributeIds, BrowseDirection, makeResultMask } from "node-opcua-data-model";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";

import { theOpcuaJSONCodec, schemaDataValue, formatForNodeWoT } from "./codec";
import { FormElementProperty } from "wot-thing-description-types";
import {
    opcuaJsonEncodeDataValue,
    opcuaJsonDecodeDataValue,
    DataValueJSON,
    opcuaJsonEncodeVariant,
    VariantJSON,
} from "node-opcua-json";
import { Argument, BrowseDescription, BrowseResult } from "node-opcua-types";
import { ReferenceTypeIds } from "node-opcua";

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

export interface OPCUAConnection {
    session: ClientSession;
    client: OPCUAClient;
    subscription: ClientSubscription;
}

export type Resolver = (...arg: [...unknown[]]) => void;
export interface OPCUAConnectionEx extends OPCUAConnection {
    pending?: Resolver[];
}

export function findBasicDataTypeC(
    session: IBasicSession,
    dataTypeId: NodeId,
    callback: (err: Error | null, dataType?: DataType) => void
): void {
    const resultMask = makeResultMask("ReferenceType");

    if (dataTypeId.identifierType === NodeIdType.NUMERIC && dataTypeId.value <= 25) {
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

            browseResult.references = browseResult.references || /* istanbul ignore next */ [];
            const baseDataType = browseResult.references[0].nodeId;
            return findBasicDataTypeC(session, baseDataType, callback);
        });
    }
}
const findBasicDataType: (session: IBasicSession, dataTypeId: NodeId) => Promise<DataType> =
    promisify(findBasicDataTypeC);

async function _resolveInputArguments(
    session: IBasicSession,
    argumentDefinition: ArgumentDefinition,
    form: OPCUAFormInvoke,
    bodyInput: Record<string, unknown>
): Promise<VariantLike[]> {
    const inputArguments = (argumentDefinition.inputArguments || []) as unknown as Argument[];

    const variants: VariantLike[] = [];
    for (let index = 0; index < inputArguments.length; index++) {
        const argument = inputArguments[index];

        const { name, dataType, /* description, */ arrayDimensions, valueRank } = argument;

        if (bodyInput[name] === undefined) {
            throw new Error("missing value in bodyInput for argument " + name);
        }
        const basicDataType = await findBasicDataType(session, dataType);
        const arrayType: VariantArrayType =
            valueRank === -1
                ? VariantArrayType.Scalar
                : valueRank === 1
                ? VariantArrayType.Array
                : VariantArrayType.Matrix;

        variants.push({
            dataType: basicDataType,
            arrayType,
            dimensions: arrayType === VariantArrayType.Matrix ? arrayDimensions : undefined,
            value: bodyInput[name],
        });
    }
    return variants;
}
async function _resolveOutputArguments(
    session: IBasicSession,
    argumentDefinition: ArgumentDefinition,
    outputVariants: Variant[]
): Promise<Record<string, unknown>> {
    const outputArguments = (argumentDefinition.outputArguments || []) as unknown as Argument[];

    const res: Record<string, unknown> = {};
    for (let index = 0; index < outputArguments.length; index++) {
        const argument = outputArguments[index];
        const { name } = argument;
        res[name] = (opcuaJsonEncodeVariant(outputVariants[index], true) as VariantJSON).Body;
    }

    return res;
}

export class OPCUAProtocolClient implements ProtocolClient {
    private _connections: Map<string, OPCUAConnectionEx> = new Map<string, OPCUAConnectionEx>();

    private async _withConnection<T>(form: OPCUAForm, next: (connection: OPCUAConnection) => Promise<T>): Promise<T> {
        const endpoint = form.href;
        if (!endpoint || !endpoint.match(/^opc.tcp:\/\//)) {
            console.debug("OPCUAProtocolClient", "invalid opcua:endpoint specified", endpoint);
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
                console.debug("[OPCUAProtocolClient:connection:backoff", "cannot connection to ", endpoint);
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
                    requestedPublishingInterval: 1000,
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
                    console.debug("[OPCUAProtocolClient|_resolveNodeId", "failed to extract " + f.path);
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
            console.debug("[OPCUAProtocolClient|resolveNodeId]", " form =", form);
            throw new Error("form must expose a 'opcua:nodeId'");
        }
        return this._resolveNodeId2(form, fNodeId);
    }

    /** extract the dataType of a variable */
    private async _predictDataType(form: OPCUAForm): Promise<DataType> {
        const fNodeId = form["opcua:nodeId"];
        if (!fNodeId) {
            console.debug("[OPCUAProtocolClient|resolveNodeId]", " form =", form);
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
            console.debug("[OPCUAProtocolClient|resolveNodeId]", " form =", form);
            throw new Error("form must expose a 'opcua:nodeId'");
        }
        return this._resolveNodeId2(form, fNodeId);
    }
    ///

    public async readResource(form: OPCUAForm): Promise<Content> {
        console.debug("[opcua-client|readResource]", "reading", form);

        const content = await this._withSession(form, async (session) => {
            const nodeId = await this._resolveNodeId(form);
            const dataValue = await session.read({
                nodeId,
                attributeId: AttributeIds.Value,
            });

            const contentType = form.contentType ?? "application/json";
            //   "application/opcua+json;type=Value;dataType=" + DataType[await this._predictDataType(form)];

            // QUESTION: how can we extend the default contentSerDes.valueToContent for application/json,
            const contentSerDes = ContentSerdes.get();
            if (contentType === "application/json") {
                const dataValueJSON = formatForNodeWoT(opcuaJsonEncodeDataValue(dataValue, true));
                const content = contentSerDes.valueToContent(dataValueJSON, schemaDataValue, contentType);
                console.debug("[opcua-client|readResource]", "contentType", content.type);
                return content;
            }
            const content = contentSerDes.valueToContent(dataValue, schemaDataValue, contentType);
            console.debug("[opcua-client|readResource]", "contentType", content.type);
            return content;
        });
        return content;
    }

    public async writeResource(form: OPCUAForm, content: Content): Promise<void> {
        const content2 = { ...content, body: await ProtocolHelpers.readStreamFully(content.body) };

        console.debug("[opcua-client|writeResource]", "write", form);
        console.debug("[opcua-client|writeResource]", "content", {
            ...content2,
            body: content2.body.toString("ascii"),
        });

        const contentSerDes = ContentSerdes.get();
        const dataValueJSON = contentSerDes.contentToValue(content2, schemaDataValue) as DataValueJSON;
        const dataValue = opcuaJsonDecodeDataValue(dataValueJSON);

        const statusCode = await this._withSession(form, async (session) => {
            const nodeId = await this._resolveNodeId(form);
            const statusCode = await session.write({
                nodeId,
                attributeId: AttributeIds.Value,
                value: dataValue,
            });
            return statusCode;
        });
        console.debug("[opcua-client|writeResource]", "statsCode", statusCode.toString());
        if (statusCode !== StatusCodes.Good) {
            // [QUESTION] should we return the status code ? or raise an exception if write failed ?
        }
    }

    public async invokeResource(form: OPCUAFormInvoke, content: Content): Promise<Content> {
        const content2 = { ...content, body: await ProtocolHelpers.readStreamFully(content.body) };

        return await this._withSession(form, async (session) => {
            const objectId = await this._resolveNodeId(form);
            const methodId = await this._resolveMethodNodeId(form);

            const argumentDefinition: ArgumentDefinition = await session.getArgumentDefinition(methodId);

            const bodyInput = JSON.parse(content2.body.toString());
            const inputArguments = await _resolveInputArguments(session, argumentDefinition, form, bodyInput);

            const callResult = await session.call({
                objectId,
                methodId,
                inputArguments,
            });
            if (callResult.statusCode !== StatusCodes.Good) {
                throw new Error("Error in Calling OPCUA MEthod : " + callResult.statusCode.toString());
            }
            const body = await _resolveOutputArguments(session, argumentDefinition, callResult.outputArguments);

            const contentType = "application/json";
            const contentSerDes = ContentSerdes.get();
            const content = contentSerDes.valueToContent(body, schemaDataValue, contentType);
            console.debug("[opcua-client|readResource]", "contentType", content.type);
            return content;
        });
    }

    public subscribeResource(
        form: OPCUAForm,
        next: (content: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        console.debug("[opcua-client|subscribeResource] : form", form["opcua:nodeId"]);

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
                samplingInterval: 100,
                discardOldest: true,
                queueSize: 10,
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
                const contentSerDes = ContentSerdes.get();
                try {
                    const content = contentSerDes.valueToContent(
                        dataValue,
                        schemaDataValue,
                        theOpcuaJSONCodec.getMediaType()
                    );
                    m.handlers.forEach((n) => n(content));
                } catch (err) {
                    console.debug(nodeId.toString(), dataValue.toString());
                    console.log((err as Error).message);
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
        console.debug("[opcua-client|unlinkResource] : form", form["opcua:nodeId"]);
        this._withSubscription<void>(form, async (session, subscription) => {
            const nodeId = await this._resolveNodeId(form);
            await this._unmonitor(nodeId);
        });
    }

    start(): Promise<void> {
        console.debug("[opcua-client|start] : Sorry not implemented");
        throw new Error("Method not implemented.");
    }

    async stop(): Promise<void> {
        console.debug("[opcua-client|stop]");
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
}

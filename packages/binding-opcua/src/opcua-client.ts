/*******************************************************************************
 * Copyright (c) 2019 - 2021 Contributors to the Eclipse Foundation
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
 * Opcua protocol binding
 */
import { ProtocolClient, Content, ProtocolHelpers } from "@node-wot/core";
import { SecurityScheme } from "wot-thing-description-types";

import * as Url from "url-parse";

import { OpcuaForm, OpcuaConfig } from "./opcua";
import {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    AttributeIds,
    TimestampsToReturn,
    MonitoringParametersOptions,
    // ReadValueIdLike, // ReadValueIdLike: ReadValueIdOptions | ReadValueId
    ReadValueIdOptions,
    ReadValueId,
    DataValue,
    UserTokenType,
    ClientSession,
    OPCUAClientOptions,
    StatusCodes,
    ClientMonitoredItem,
    ClientSubscription,
} from "node-opcua-client";
import * as cryptoUtils from "node-opcua-crypto";
import { Subscription } from "rxjs/Subscription";
import { Readable } from "stream";

async function decodeContent(content: Content): Promise<Record<string, any> | Record<string, any>[]> {
    if (content) {
        const body = await ProtocolHelpers.readStreamFully(content.body);
        const payload = JSON.parse(body.toString("ascii"));
        return payload;
    } else {
        return {};
    }
}

export default class OpcuaClient implements ProtocolClient {
    private client?: OPCUAClient;
    private credentials: any;
    private session?: ClientSession;
    private subscription?: ClientSubscription;
    private clientOptions: OPCUAClientOptions;
    private config: OpcuaConfig;
    constructor(_config: OpcuaConfig = null) {
        this.credentials = null;
        this.clientOptions = {
            applicationName: "Client",
            keepSessionAlive: true,
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            connectionStrategy: {
                initialDelay: 0,
                maxRetry: 1,
            },
            requestedSessionTimeout: 10000,
            endpointMustExist: false,
        };
        if (_config) {
            this.config = _config;
        }
    }

    public toString(): string {
        return "[OpcuaClient]";
    }

    private async connect(endpointUrl: string): Promise<void> {
        let userIdentity: any;

        if (this.credentials) {
            if (this.credentials.password) {
                userIdentity = {
                    userName: this.credentials.username,
                    password: this.credentials.password,
                    type: UserTokenType.UserName,
                };
            } else if (this.credentials.clientCertificate) {
                const clientCertificate: cryptoUtils.Certificate = cryptoUtils.readCertificate(
                    this.credentials.clientCertificate
                );
                const privateKey: cryptoUtils.PrivateKeyPEM = cryptoUtils.readPrivateKeyPEM(
                    this.credentials.clientPrivateKey
                );
                this.clientOptions.securityMode = MessageSecurityMode.SignAndEncrypt;
                this.clientOptions.securityPolicy = SecurityPolicy.Basic256Sha256;

                this.clientOptions.certificateFile = this.credentials.clientCertificate;
                this.clientOptions.privateKeyFile = this.credentials.clientPrivateKey;
                this.clientOptions.serverCertificate = cryptoUtils.readCertificate(this.credentials.serverCertificate);
                userIdentity = {
                    certificateData: clientCertificate,
                    privateKey,
                    type: UserTokenType.Certificate,
                };
            }
        } else {
            userIdentity = null;
        }
        this.client = OPCUAClient.create(this.clientOptions);
        await this.client.connect(endpointUrl);
        this.session = await this.client.createSession(userIdentity);
    }

    public async readResource(form: OpcuaForm): Promise<Content> {
        const url = new Url(form.href);
        const endpointUrl = `${url.protocol}//${url.host}`;
        const method = form["opc:method"] ? form["opc:method"] : "READ";

        const contentType = "application/x.opcua-binary";
        await this.checkConnection(endpointUrl);

        const params: {
            ns: string;
            idtype: string;
            mns: string;
            midtype: string;
        } = this.extractParams(url.pathname.toString().substr(1));

        const nodeId = params.ns + ";" + params.idtype;
        const nodeToRead = {
            nodeId,
            attributeId: AttributeIds.Value,
        };

        let result: DataValue;
        try {
            result = await this.session.read(nodeToRead);
        } catch (err) {
            console.debug("[binding-opcua]", err);
            throw err;
        }
        if (result.statusCode === StatusCodes.BadNodeIdUnknown) {
            throw new Error("Invalid nodeId");
        }
        const body = JSON.stringify(result.toJSON());
        return { type: contentType, body: Readable.from(Buffer.from(body)) };
    }

    public async writeResource(form: OpcuaForm, content: Content): Promise<any> {
        const body = await ProtocolHelpers.readStreamFully(content.body);
        const payload: any = content ? JSON.parse(body.toString()) : {};
        const url = new Url(form.href);
        const endpointUrl = `${url.protocol}//${url.host}`;
        const method = form["opc:method"] ? form["opc:method"] : "WRITE";
        const contentType = "application/x.opcua-binary";

        const dataType = payload.dataType;

        await this.checkConnection(endpointUrl);

        const params: {
            ns: string;
            idtype: string;
            mns: string;
            midtype: string;
        } = this.extractParams(url.pathname.toString().substr(1));
        const nodeId = params.ns + ";" + params.idtype;
        try {
            const nodeToWrite = {
                nodeId: nodeId,
                attributeId: AttributeIds.Value,
                value: /* DataValue */ {
                    // sourceTimestamp: new Date(), // FIXME: to be optional
                    // statusCode: StatusCodes.Good,
                    value: /* Variant */ {
                        dataType,
                        value: payload.payload,
                    },
                },
            };
            const statusCode = await this.session.write(nodeToWrite);
            if (statusCode === StatusCodes.Good) {
                return;
            } else {
                const err = new Error(statusCode.toString());
                throw err;
            }
        } catch (err) {
            console.debug("[binding-opcua]", err);
            throw err;
        }
    }

    public async invokeResource(form: OpcuaForm, content: Content): Promise<Content> {
        const url = new Url(form.href);

        const endpointUrl = `${url.protocol}//${url.host}`;
        const method = form["opc:method"] ? form["opc:method"] : "CALL_METHOD";

        const contentType = "application/x.opcua-binary";

        await this.checkConnection(endpointUrl);

        const params: {
            ns: string;
            idtype: string;
            mns: string;
            midtype: string;
        } = this.extractParams(url.pathname.toString().substr(1));

        const objectId = params.ns + ";" + params.idtype;
        const nodeId = params.mns + ";" + params.midtype;

        if (method === "CALL_METHOD") {
            const payload: any = await decodeContent(content);

            const methodToCall = {
                methodId: nodeId,
                objectId: objectId,
                inputArguments: payload.inputArguments,
            };
            const result = await this.session.call(methodToCall);

            console.log("[binding-opcua]", "[invoke]", result.toString());

            const statusCode = result.statusCode;
            if (statusCode !== StatusCodes.Good) {
                console.debug("[binding-opcua]", statusCode);
                throw new Error(statusCode.toString());
            }
            const outputArgs = result.outputArguments.map((outputArg) => outputArg.toJSON());
            const body: string = JSON.stringify(outputArgs);
            return { type: contentType, body: Readable.from(Buffer.from(body, "ascii")) };
        } else {
            throw new Error("Invalid method : " + method);
        }
    }

    public unlinkResource(form: OpcuaForm): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            reject(new Error(`OpcuaClient does not implement unlink`));
        });
    }

    private async checkConnection(endpointUrl: string) {
        if (!this.session) {
            try {
                await this.connect(endpointUrl);
            } catch (err) {
                console.debug("[binding-opcua]", err);
                throw err;
            }
        }
    }

    private async getOrCreateSubscription(): Promise<ClientSubscription> {
        if (this.subscription) {
            return this.subscription;
        }
        const defaultSubscriptionOptions = {
            requestedPublishingInterval: 1000,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 100,
            publishingEnabled: true,
            priority: 10,
        };

        const subscriptionParameters =
            this.config && this.config.subscriptionOptions
                ? this.config.subscriptionOptions
                : defaultSubscriptionOptions;

        this.subscription = await this.session.createSubscription2(subscriptionParameters);
        return this.subscription;
    }
    public async subscribeResource(
        form: OpcuaForm,
        next: (value: Content) => void,
        error?: (error: any) => void,
        complete?: () => void
    ): Promise<Subscription> {
        const url = new Url(form.href);
        const endpointUrl = `${url.protocol}//${url.host}`;

        await this.checkConnection(endpointUrl);

        const subscription = await this.getOrCreateSubscription();

        const params: {
            ns: string;
            idtype: string;
            mns: string;
            midtype: string;
        } = this.extractParams(url.pathname.toString().substr(1));
        const nodeId = params.ns + ";" + params.idtype;
        const itemToMonitor: ReadValueIdOptions | ReadValueId = {
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
        };
        const parameters: MonitoringParametersOptions = {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 10,
        };

        const monitoredItem = await new Promise<ClientMonitoredItem>((resolve, reject) => {
            const monitoredItem = ClientMonitoredItem.create(
                subscription,
                itemToMonitor,
                parameters,
                TimestampsToReturn.Both
            );
            monitoredItem.once("err", async (error: string) => {
                const err = new Error("Error while subscribing property: " + monitoredItem.statusCode.toString());
                reject(err);
            });
            monitoredItem.once("initialized", async () => {
                resolve(monitoredItem);
            });
        });
        monitoredItem.on("changed", (dataValue: DataValue) => {
            const body = JSON.stringify(dataValue.toJSON());
            const contentType = "application/x.opcua-binary";

            next({ type: contentType, body: Readable.from(Buffer.from(body)) });
        });

        return new Subscription(async () => {
            await monitoredItem.terminate();
        });
    }

    public start(): boolean {
        return true;
    }

    public async stopAsync(): Promise<boolean> {
        const { subscription, session, client } = this;
        this.subscription = undefined;
        this.session = undefined;
        this.client = undefined;
        if (subscription) {
            await subscription.terminate();
        }
        if (session) {
            await session.close();
        }
        if (client) {
            await client.disconnect();
        }
        return true;
    }

    public stop(): boolean {
        // note: Stop should really be an async function !!
        this.stopAsync();
        return true;
    }

    public setSecurity(metadata: Array<SecurityScheme>, credentials?: any): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            console.warn("[binding-opcua]", `OpcuaClient without security`);
            return false;
        }
        if (!credentials || (!credentials.password && !credentials.privateKey)) {
            console.warn("[binding-opcua]", `Both password and certificate missing inside credentials`);
        }
        this.credentials = credentials;
    }

    private extractParams(url: string): { ns: string; idtype: string; mns: string; midtype: string } {
        try {
            url = decodeURI(url);
        } catch (err) {
            console.error(err);
        }
        const res: {
            ns: string;
            idtype: string;
            mns: string;
            midtype: string;
        } = {
            ns: null,
            idtype: null,
            mns: null,
            midtype: null,
        };
        for (let i = 0; i < url.split(";").length; i++) {
            const value = url.split(";")[i];
            if (value.includes("mns=")) {
                res.mns = value.replace("mns", "ns");
            } else if (value.includes("ns=")) {
                res.ns = value;
            } else if (
                value.includes("mb=") ||
                value.includes("ms=") ||
                value.includes("mg=") ||
                value.includes("mi=")
            ) {
                let midtype = value.split("=")[0];
                midtype = midtype.substr(1);
                res.midtype = midtype + "=" + value.split("=")[1];
            } else if (value.includes("b=") || value.includes("s=") || value.includes("g=") || value.includes("i=")) {
                res.idtype = value;
            }
        }
        return res;
    }
}

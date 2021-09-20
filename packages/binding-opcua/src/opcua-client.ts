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
import * as TD from "@node-wot/td-tools";

import * as Url from "url-parse";

import { OpcuaForm, OpcuaConfig } from "./opcua";
import {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    AttributeIds,
    ClientSubscription,
    TimestampsToReturn,
    MonitoringParametersOptions,
    // ReadValueIdLike, // ReadValueIdLike: ReadValueIdOptions | ReadValueId
    ReadValueIdOptions,
    ReadValueId,
    ClientMonitoredItem,
    DataValue,
    UserTokenType,
} from "node-opcua-client";
import * as cryptoUtils from "node-opcua-crypto";
import { Subscription } from "rxjs/Subscription";
import { Readable } from "stream";

export default class OpcuaClient implements ProtocolClient {
    private client: OPCUAClient;
    private credentials: any;
    private session: any;
    private clientOptions: any;
    private config: OpcuaConfig;
    constructor(_config: OpcuaConfig = null) {
        this.credentials = null;
        this.session = null;
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

    private async connect(endpointUrl: string, next?: () => void) {
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
                this.clientOptions.serverCertificate = cryptoUtils.readCertificate(
                    this.credentials.serverCertificate
                );
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

        if (next) {
            // callback version
            next();
        }
    }

    public async readResource(form: OpcuaForm): Promise<Content> {
        const url = new Url(form.href);
        const endpointUrl = `${url.protocol}//${url.host}`;
        const method = form["opc:method"] ? form["opc:method"] : "READ";

        const contentType = "application/x.opcua-binary";

        if (this.session === null) {
            try {
                await this.connect(endpointUrl);
            } catch (err) {
                console.debug("[binding-opcua]", err);
                throw err;
            }
        }

        let result: any;

        try {
            const params: {
                ns: string;
                idtype: string;
                mns: string;
                midtype: string;
            } = this.extractParams(url.pathname.toString().substr(1));

            const nodeId = params.ns + ";" + params.idtype;
            const nodeToRead = {
                nodeId: nodeId,
            };

            result = await this.session.read(nodeToRead);
            result = JSON.stringify(result);
        } catch (err) {
            console.debug("[binding-opcua]", err);
            throw err;
        }

        return new Promise<Content>((resolve, reject) => {
            resolve({ type: contentType, body: Readable.from(Buffer.from(result)) });
        });
    }

    public async writeResource(form: OpcuaForm, content: Content): Promise<any> {
        const body = await ProtocolHelpers.readStreamFully(content.body);
        const payload: any = content ? JSON.parse(body.toString()) : {};
        const url = new Url(form.href);
        const endpointUrl = `${url.protocol}//${url.host}`;
        const method = form["opc:method"] ? form["opc:method"] : "WRITE";
        const contentType = "application/x.opcua-binary";

        let res = false;
        const dataType = payload.dataType;

        if (this.session === null) {
            try {
                await this.connect(endpointUrl);
            } catch (err) {
                console.debug("[binding-opcua]", err);
                throw err;
            }
        }

        let result: any;
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
            result = await this.session.write(nodeToWrite);
            if (result._name === "Good" && result.value === 0) {
                res = true;
            } else if (result._description) {
                const err = new Error(result._description);
                throw err;
            }
        } catch (err) {
            console.debug("[binding-opcua]", err);
            throw err;
        }

        return new Promise<void>((resolve, reject) => {
            if (res) {
                resolve(undefined);
            } else {
                reject(new Error("Error while writing property"));
            }
        });
    }

    public async invokeResource(form: OpcuaForm, content: Content): Promise<any> {
        let payload;
        if (content) {
            const body = await ProtocolHelpers.readStreamFully(content.body);
            payload = JSON.parse(body.toString());
        }

        const url = new Url(form.href);

        const endpointUrl = `${url.protocol}//${url.host}`;
        const method = form["opc:method"] ? form["opc:method"] : "CALL_METHOD";

        const contentType = "application/x.opcua-binary";
        if (this.session === null) {
            try {
                await this.connect(endpointUrl);
            } catch (err) {
                console.debug("[binding-opcua]", err);
                throw err;
            }
        }

        let result: any;
        const params: {
            ns: string;
            idtype: string;
            mns: string;
            midtype: string;
        } = this.extractParams(url.pathname.toString().substr(1));
        const objectId = params.ns + ";" + params.idtype;
        const nodeId = params.mns + ";" + params.midtype;
        const methodToCalls: any[] = [];
        let req;
        if (method === "CALL_METHOD") {
            req = {
                methodId: nodeId,
                objectId: objectId,
                inputArguments: payload.inputArguments,
            };
            methodToCalls.push(req);
            result = await this.session.call(methodToCalls);
            const status = result[0].statusCode;
            if (status._value !== 0 || status._name !== "Good") {
                console.debug("[binding-opcua]", status);
                throw new Error(status);
            }

            return new Promise((resolve, reject) => {
                resolve({ type: contentType, body: result[0].outputArguments[0] });
            });
        }
    }

    public unlinkResource(form: OpcuaForm): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            reject(new Error(`OpcuaClient does not implement unlink`));
        });
    }

    private async checkConnection(endpointUrl: string) {
        if (this.session === null) {
            try {
                await this.connect(endpointUrl);
            } catch (err) {
                console.debug("[binding-opcua]", err);
                throw err;
            }
        }
    }

    public subscribeResource(
        form: OpcuaForm,
        next: (value: any) => void,
        error?: (error: any) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            let url = new Url(form.href);
            let endpointUrl = url.origin;
            let contentType = "application/x.opcua-binary";
            let self = this;
            this.checkConnection(endpointUrl)
                .then(function () {
                    try {
                        const params: {
                            ns: string;
                            idtype: string;
                            mns: string;
                            midtype: string;
                        } = self.extractParams(url.pathname.toString().substr(1));
                        const nodeId = params.ns + ";" + params.idtype;

                        let subscription: any;
                        const defaultSubscriptionOptions = {
                            requestedPublishingInterval: 1000,
                            requestedLifetimeCount: 100,
                            requestedMaxKeepAliveCount: 10,
                            maxNotificationsPerPublish: 100,
                            publishingEnabled: true,
                            priority: 10,
                        };
                        if (self.config && self.config.subscriptionOptions) {
                            subscription = ClientSubscription.create(self.session, self.config.subscriptionOptions);
                        } else {
                            subscription = ClientSubscription.create(self.session, defaultSubscriptionOptions);
                        }

                        const itemToMonitor: ReadValueIdOptions | ReadValueId = {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                        };
                        const parameters: MonitoringParametersOptions = {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 10,
                        };

                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            itemToMonitor,
                            parameters,
                            TimestampsToReturn.Both
                        );

                        monitoredItem.once("err", (error: string) => {
                            monitoredItem.removeAllListeners();
                            reject(new Error(`Error while subscribing property: ${error}`));
                        });

                        monitoredItem.on("initialized", () => {
                            // remove initialization error listener
                            monitoredItem.removeAllListeners("error");
                            // forward next errors to the callback if any
                            error && monitoredItem.on("err", error);

                            resolve(new Subscription(() => {}));
                        });

                        monitoredItem.on("changed", (dataValue: DataValue) => {
                            next({ type: contentType, body: dataValue.value });
                        });
                    } catch (err) {
                        reject(new Error(`Error while subscribing property`));
                    }
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    public start(): boolean {
        return true;
    }

    public stop(): boolean {
        return true;
    }

    public setSecurity(metadata: Array<TD.SecurityScheme>, credentials?: any): boolean {
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

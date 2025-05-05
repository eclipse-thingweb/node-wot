/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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
 * Modbus master based on modbus-serial
 */
import { ModbusForm, ModbusFunction } from "./modbus";

import { ProtocolClient, Content, DefaultContent, SecurityScheme, createDebugLogger, Endianness } from "@node-wot/core";
import { modbusFunctionToEntity } from "./utils";
import { ModbusConnection, ModbusFormWithDefaults, PropertyOperation } from "./modbus-connection";
import { Readable } from "stream";
import { Subscription } from "rxjs/Subscription";

const debug = createDebugLogger("binding-modbus", "modbus-client");

const DEFAULT_PORT = 805;
const DEFAULT_TIMEOUT = 1000;
const DEFAULT_POLLING = 2000;

class ModbusSubscription {
    interval: NodeJS.Timeout;
    complete: () => void;
    constructor(
        form: ModbusForm,
        client: ModbusClient,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ) {
        if (!complete) {
            complete = () => {
                // do nothing.
            };
        }
        this.interval = global.setInterval(async () => {
            try {
                const result = await client.readResource(form);
                next(result);
            } catch (e) {
                if (error) {
                    error(e instanceof Error ? e : new Error(JSON.stringify(e)));
                }
                clearInterval(this.interval);
            }
        }, form["modv:pollingTime"]); // TODO: Until https://github.com/eclipse-thingweb/node-wot/issues/1236 is clarified, we will use this as the polling rate.

        this.complete = complete;
    }

    unsubscribe() {
        clearInterval(this.interval);
        this.complete();
    }
}

export default class ModbusClient implements ProtocolClient {
    private _connections: Map<string, ModbusConnection>;

    private _subscriptions: Map<string, ModbusSubscription> = new Map();

    constructor() {
        this._connections = new Map();
    }

    readResource(form: ModbusForm): Promise<Content> {
        return this.performOperation(form) as Promise<Content>;
    }

    async writeResource(form: ModbusForm, content: Content): Promise<void> {
        await this.performOperation(form, content);
    }

    async invokeResource(form: ModbusForm, content: Content): Promise<Content> {
        await this.performOperation(form, content);

        // Same with MQTT, there is no response
        return new DefaultContent(Readable.from(""));
    }

    unlinkResource(form: ModbusForm): Promise<void> {
        form = this.validateAndFillDefaultForm(form, 0);
        const id = `${form.href}/${form["modv:unitID"]}#${form["modv:function"]}?${form["modv:address"]}&${form["modv:quantity"]}`;

        const subscription = this._subscriptions.get(id);
        if (!subscription) {
            throw new Error("No subscription for " + id + " found");
        }
        subscription.unsubscribe();

        this._subscriptions.delete(id);

        return Promise.resolve();
    }

    public subscribeResource(
        form: ModbusForm,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            form = this.validateAndFillDefaultForm(form, 0);

            const id = `${form.href}/${form["modv:unitID"]}#${form["modv:function"]}?${form["modv:address"]}&${form["modv:quantity"]}`;

            if (this._subscriptions.has(id)) {
                reject(new Error("Already subscribed for " + id + ". Multiple subscriptions are not supported"));
            }

            const subscription = new ModbusSubscription(form, this, next, error, complete);

            this._subscriptions.set(id, subscription);
            resolve(
                new Subscription(() => {
                    subscription.unsubscribe();
                })
            );
        });
    }

    /**
     * @inheritdoc
     */
    public async requestThingDescription(uri: string): Promise<Content> {
        throw new Error("Method not implemented");
    }

    async start(): Promise<void> {
        // do nothing
    }

    async stop(): Promise<void> {
        this._connections.forEach((connection) => {
            connection.close();
        });
    }

    setSecurity(metadata: SecurityScheme[], credentials?: unknown): boolean {
        return false;
    }

    private async performOperation(form: ModbusForm, content?: Content): Promise<Content | void> {
        // get host and port
        const parsed = new URL(form.href);
        const port = parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORT;
        let body;
        if (content != null) {
            body = await content.toBuffer();
        }
        const formValidated = this.validateAndFillDefaultForm(form, body?.byteLength);

        const endianness = this.validateEndianness(formValidated);

        const host = parsed.hostname;
        const hostAndPort = host + ":" + port;

        if (body != null) {
            this.validateBufferLength(formValidated, body);
        }

        // find or create connection
        let connection = this._connections.get(hostAndPort);

        if (!connection) {
            debug(`Creating new ModbusConnection for ${hostAndPort}`);

            connection = new ModbusConnection(host, port, {
                connectionTimeout: form["modv:timeout"] ?? DEFAULT_TIMEOUT,
            });
            this._connections.set(hostAndPort, connection);
        } else {
            debug(`Reusing ModbusConnection for ${hostAndPort}`);
        }
        // create operation
        const operation = new PropertyOperation(formValidated, endianness, body);

        // enqueue the operation at the connection
        connection.enqueue(operation);

        // return a promise to execute the operation
        return operation.execute();
    }

    private validateEndianness(form: ModbusForm): Endianness {
        let endianness = Endianness.BIG_ENDIAN;
        if (form.contentType != null) {
            const contentValues: string[] = form.contentType.split(";") ?? [];
            // Check endian-ness
            const byteSeq = contentValues.find((value) => /^byteSeq=/.test(value));
            if (byteSeq != null) {
                const guessEndianness = Endianness[byteSeq.split("=")[1] as keyof typeof Endianness];
                if (guessEndianness != null) {
                    endianness = guessEndianness;
                } else {
                    throw new Error("Malformed form: Content Type endianness is not valid");
                }
            }
        }
        return endianness;
    }

    // This generates a form used internally with url content based on the uri scheme
    // Ideally, more code should be refactored to use uri only
    private addFormElementsFromURLPath(input: ModbusForm): ModbusForm {
        const returnForm: ModbusForm = { ...input };
        const { pathname, searchParams: query } = new URL(input.href);
        const pathComp = pathname.split("/");
        if (pathComp.length < 3 || pathComp[1] === "" || pathComp[2] === "") {
            throw new Error("Malformed href: unitID and address must be defined");
        }
        returnForm["modv:unitID"] = parseInt(pathComp[1], 10);
        returnForm["modv:address"] = parseInt(pathComp[2], 10);

        const queryQuantity = query.get("quantity");
        if (queryQuantity != null) {
            returnForm["modv:quantity"] = parseInt(queryQuantity, 10);
        }
        return returnForm;
    }

    private validateBufferLength(form: ModbusFormWithDefaults, buffer: Buffer) {
        const mpy = form["modv:entity"] === "InputRegister" || form["modv:entity"] === "HoldingRegister" ? 2 : 1;
        const quantity = form["modv:quantity"];
        if (buffer.length !== mpy * quantity) {
            throw new Error(
                "Content length does not match register / coil count, got " +
                    buffer.length +
                    " bytes for " +
                    quantity +
                    ` ${mpy === 2 ? "registers" : "coils"}`
            );
        }
    }

    private validateAndFillDefaultForm(inputForm: ModbusForm, contentLength = 0): ModbusFormWithDefaults {
        const mode = contentLength > 0 ? "w" : "r";

        // Use URI values to generate form keys
        const filledForm: ModbusForm = this.addFormElementsFromURLPath(inputForm);

        // take over latest content of form into a new result set
        const result: ModbusForm = { ...filledForm };

        if (filledForm["modv:function"] == null && filledForm["modv:entity"] == null) {
            throw new Error("Malformed form: modv:function or modv:entity must be defined");
        }

        if (filledForm["modv:function"] != null) {
            // Convert string function to enums if defined
            if (typeof filledForm["modv:function"] === "string") {
                result["modv:function"] = ModbusFunction[filledForm["modv:function"]];
            }

            // Check if the function is a valid modbus function code
            if (!Object.keys(ModbusFunction).includes(filledForm["modv:function"].toString())) {
                throw new Error("Undefined function number or name: " + filledForm["modv:function"]);
            }
        }

        if (filledForm["modv:entity"]) {
            switch (filledForm["modv:entity"]) {
                case "Coil":
                    result["modv:function"] =
                        mode === "r"
                            ? ModbusFunction.readCoil
                            : contentLength > 1
                              ? ModbusFunction.writeMultipleCoils
                              : ModbusFunction.writeSingleCoil;
                    break;
                case "HoldingRegister":
                    // the content length must be divided by 2 (holding registers are 16bit)
                    result["modv:function"] =
                        mode === "r"
                            ? ModbusFunction.readHoldingRegisters
                            : contentLength / 2 > 1
                              ? ModbusFunction.writeMultipleHoldingRegisters
                              : ModbusFunction.writeSingleHoldingRegister;
                    break;
                case "InputRegister":
                    result["modv:function"] = ModbusFunction.readInputRegister;
                    break;
                case "DiscreteInput":
                    result["modv:function"] = ModbusFunction.readDiscreteInput;
                    break;
                default:
                    throw new Error("Unknown modbus entity: " + filledForm["modv:entity"]);
            }
        } else {
            // 'modv:entity' undefined but modv:function defined
            result["modv:entity"] = modbusFunctionToEntity(result["modv:function"] as ModbusFunction);
        }

        if (filledForm["modv:address"] === undefined || filledForm["modv:address"] === null) {
            throw new Error("Malformed form: address must be defined");
        }

        const hasQuantity = filledForm["modv:quantity"] != null;

        if (!hasQuantity && contentLength === 0) {
            result["modv:quantity"] = 1;
        } else if (!hasQuantity && contentLength > 0) {
            const regSize =
                result["modv:entity"] === "InputRegister" || result["modv:entity"] === "HoldingRegister" ? 2 : 1;
            result["modv:quantity"] = contentLength / regSize;
        }

        result["modv:pollingTime"] ??= DEFAULT_POLLING;
        result["modv:timeout"] ??= DEFAULT_TIMEOUT;

        return result as ModbusFormWithDefaults;
    }
}

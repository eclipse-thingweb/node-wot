/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
import * as net from "net";
import {
    COMMAND,
    CipReply,
    EipError,
    EncapsulationDecoder,
    EncapsulationFrame,
    decodeSendRRData,
    encodeEncapsulation,
    encodeRoutePath,
    encodeSendRRData,
    encodeUnconnectedSend,
    parseCipReply,
} from "./eip-protocol";

export interface EipSessionOptions {
    host: string;
    port: number;
    /** CIP route path as port/address pairs, see {@link parseEipHref}. */
    routePath: string[];
}

interface Waiter {
    context: number;
    resolve: (frame: EncapsulationFrame) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
}

/**
 * One EtherNet/IP session to a communication module. CIP requests are sent through unconnected
 * messaging, one at a time, and the TCP connection is re-established after any failure.
 */
export class EipSession {
    private readonly route: Buffer;
    private socket: net.Socket | undefined;
    private registered = false;
    private sessionHandle = 0;
    private decoder = new EncapsulationDecoder();
    private waiter: Waiter | undefined;
    private contextCounter = 0;
    private queue: Promise<unknown> = Promise.resolve();

    constructor(private readonly options: EipSessionOptions) {
        this.route = encodeRoutePath(options.routePath);
    }

    request(cip: Buffer, timeoutMs: number): Promise<CipReply> {
        const run = async (): Promise<CipReply> => {
            await this.ensureSession(timeoutMs);
            const payload = encodeSendRRData(encodeUnconnectedSend(cip, this.route));
            const frame = await this.exchange(COMMAND.SendRRData, payload, timeoutMs);
            return parseCipReply(decodeSendRRData(frame.data));
        };
        const result = this.queue.then(run);
        this.queue = result.catch(() => undefined);
        return result;
    }

    close(): void {
        const socket = this.socket;
        if (socket === undefined) return;
        if (this.registered) {
            socket.write(
                encodeEncapsulation(COMMAND.UnRegisterSession, this.sessionHandle, Buffer.alloc(8), Buffer.alloc(0))
            );
        }
        this.fail(socket, new EipError("Session closed"));
    }

    private async ensureSession(timeoutMs: number): Promise<void> {
        if (this.socket !== undefined && this.registered) return;
        const { host, port } = this.options;
        const socket = new net.Socket();
        socket.setNoDelay(true);
        this.socket = socket;
        this.decoder = new EncapsulationDecoder();
        socket.on("data", (chunk) => this.onData(socket, chunk));
        socket.on("error", (err) => this.fail(socket, err));
        socket.on("close", () => this.fail(socket, new EipError("Connection closed")));

        try {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(
                    () => reject(new EipError(`Connecting to ${host}:${port} timed out after ${timeoutMs} ms`)),
                    timeoutMs
                );
                socket.once("connect", () => {
                    clearTimeout(timer);
                    resolve();
                });
                socket.once("error", (err) => {
                    clearTimeout(timer);
                    reject(err);
                });
                socket.connect(port, host);
            });
            const frame = await this.exchange(COMMAND.RegisterSession, Buffer.from([1, 0, 0, 0]), timeoutMs);
            this.sessionHandle = frame.sessionHandle;
            this.registered = true;
        } catch (err) {
            this.fail(socket, err instanceof Error ? err : new EipError(String(err)));
            throw err;
        }
    }

    private exchange(command: number, data: Buffer, timeoutMs: number): Promise<EncapsulationFrame> {
        const socket = this.socket;
        if (socket === undefined) return Promise.reject(new EipError("Not connected"));
        const context = ++this.contextCounter;
        const senderContext = Buffer.alloc(8);
        senderContext.writeUInt32LE(context);
        return new Promise<EncapsulationFrame>((resolve, reject) => {
            const timer = setTimeout(
                () => this.fail(socket, new EipError(`No reply from the controller within ${timeoutMs} ms`)),
                timeoutMs
            );
            this.waiter = { context, resolve, reject, timer };
            socket.write(encodeEncapsulation(command, this.sessionHandle, senderContext, data));
        });
    }

    private onData(socket: net.Socket, chunk: Buffer): void {
        if (socket !== this.socket) return;
        for (const frame of this.decoder.push(chunk)) {
            const waiter = this.waiter;
            if (waiter === undefined || frame.senderContext.readUInt32LE(0) !== waiter.context) continue;
            this.waiter = undefined;
            clearTimeout(waiter.timer);
            if (frame.status !== 0) {
                waiter.reject(new EipError(`Encapsulation error status 0x${frame.status.toString(16)}`));
            } else {
                waiter.resolve(frame);
            }
        }
    }

    private fail(socket: net.Socket, error: Error): void {
        if (socket !== this.socket) return;
        const waiter = this.waiter;
        this.waiter = undefined;
        this.socket = undefined;
        this.registered = false;
        this.sessionHandle = 0;
        socket.destroy();
        if (waiter !== undefined) {
            clearTimeout(waiter.timer);
            waiter.reject(error);
        }
    }
}

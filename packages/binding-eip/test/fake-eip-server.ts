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
    EncapsulationDecoder,
    EncapsulationFrame,
    STRUCTURE_TYPE_CODE,
    decodeSendRRData,
    encodeEncapsulation,
    encodeSendRRData,
} from "../src/eip-protocol";

export interface FakeTag {
    typeCode: number;
    structureHandle?: number;
    elementSize: number;
    data: Buffer;
}

export interface FakeRequest {
    service: number;
    tag: string;
    route: Buffer;
}

const SESSION_HANDLE = 0x1234;

function u16(value: number): Buffer {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(value);
    return buf;
}

function decodePath(path: Buffer): string {
    let result = "";
    let indices: number[] = [];
    const flush = () => {
        if (indices.length > 0) result += `[${indices.join(",")}]`;
        indices = [];
    };
    for (let i = 0; i < path.length; ) {
        switch (path[i]) {
            case 0x91: {
                flush();
                const length = path[i + 1];
                result += (result === "" ? "" : ".") + path.toString("latin1", i + 2, i + 2 + length);
                i += 2 + length + (length % 2);
                break;
            }
            case 0x28:
                indices.push(path[i + 1]);
                i += 2;
                break;
            case 0x29:
                indices.push(path.readUInt16LE(i + 2));
                i += 4;
                break;
            case 0x2a:
                indices.push(path.readUInt32LE(i + 2));
                i += 6;
                break;
            default:
                throw new Error(`Unexpected path segment 0x${path[i].toString(16)}`);
        }
    }
    flush();
    return result;
}

/** A minimal in-process EtherNet/IP endpoint that serves tags through the Logix tag services. */
export class FakeEipServer {
    readonly tags = new Map<string, FakeTag>();
    requests: FakeRequest[] = [];
    connections = 0;
    /** Data bytes per Read Tag reply; larger values are answered with a partial transfer. */
    maxFragment = 400;
    /** When set, SendRRData requests are accepted but never answered. */
    silent = false;

    private readonly server = net.createServer((socket) => this.onConnection(socket));
    private readonly sockets = new Set<net.Socket>();

    async start(): Promise<number> {
        await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
        return (this.server.address() as net.AddressInfo).port;
    }

    async stop(): Promise<void> {
        this.dropConnections();
        await new Promise<void>((resolve) => this.server.close(() => resolve()));
    }

    dropConnections(): void {
        this.sockets.forEach((socket) => socket.destroy());
        this.sockets.clear();
    }

    reset(): void {
        this.tags.clear();
        this.requests = [];
        this.connections = 0;
        this.maxFragment = 400;
        this.silent = false;
    }

    addTag(name: string, typeCode: number, elementSize: number, data: Buffer, structureHandle?: number): FakeTag {
        const tag = { typeCode, structureHandle, elementSize, data };
        this.tags.set(name, tag);
        return tag;
    }

    private onConnection(socket: net.Socket): void {
        this.connections++;
        this.sockets.add(socket);
        const decoder = new EncapsulationDecoder();
        socket.on("data", (chunk) => decoder.push(chunk).forEach((frame) => this.onFrame(socket, frame)));
        socket.on("error", () => undefined);
        socket.on("close", () => this.sockets.delete(socket));
    }

    private onFrame(socket: net.Socket, frame: EncapsulationFrame): void {
        if (frame.command === COMMAND.RegisterSession) {
            socket.write(
                encodeEncapsulation(
                    COMMAND.RegisterSession,
                    SESSION_HANDLE,
                    frame.senderContext,
                    Buffer.from([1, 0, 0, 0])
                )
            );
        } else if (frame.command === COMMAND.UnRegisterSession) {
            socket.end();
        } else if (frame.command === COMMAND.SendRRData && !this.silent) {
            const cip = decodeSendRRData(frame.data);
            const size = cip.readUInt16LE(8);
            const embedded = cip.subarray(10, 10 + size);
            const routeStart = 10 + size + (size % 2);
            const route = cip.subarray(routeStart + 2, routeStart + 2 + cip[routeStart] * 2);
            const reply = this.handle(embedded, route);
            socket.write(
                encodeEncapsulation(
                    COMMAND.SendRRData,
                    frame.sessionHandle,
                    frame.senderContext,
                    encodeSendRRData(reply)
                )
            );
        }
    }

    private typeHeader(tag: FakeTag): Buffer {
        if (tag.typeCode === STRUCTURE_TYPE_CODE)
            return Buffer.concat([u16(tag.typeCode), u16(tag.structureHandle ?? 0)]);
        return u16(tag.typeCode);
    }

    private reply(service: number, status: number, data: Buffer = Buffer.alloc(0), extended: number[] = []): Buffer {
        return Buffer.concat([Buffer.from([service | 0x80, 0, status, extended.length]), ...extended.map(u16), data]);
    }

    private handle(request: Buffer, route: Buffer): Buffer {
        const service = request[0];
        const pathEnd = 2 + request[1] * 2;
        const name = decodePath(request.subarray(2, pathEnd));
        const body = request.subarray(pathEnd);
        this.requests.push({ service, tag: name, route: Buffer.from(route) });

        const tag = this.tags.get(name);
        if (tag === undefined) return this.reply(service, 0x04, Buffer.alloc(0), [0]);

        if (service === 0x4c || service === 0x52) {
            const elements = body.readUInt16LE(0);
            const offset = service === 0x52 ? body.readUInt32LE(2) : 0;
            const whole = tag.data.subarray(0, elements * tag.elementSize);
            const chunk = whole.subarray(offset, offset + this.maxFragment);
            const partial = offset + chunk.length < whole.length;
            return this.reply(service, partial ? 0x06 : 0, Buffer.concat([this.typeHeader(tag), chunk]));
        }
        if (service === 0x4d || service === 0x53) {
            const typeCode = body.readUInt16LE(0);
            const isStructure = typeCode === STRUCTURE_TYPE_CODE;
            const headerLength = isStructure ? 4 : 2;
            const handle = isStructure ? body.readUInt16LE(2) : undefined;
            if (typeCode !== tag.typeCode || handle !== tag.structureHandle) {
                return this.reply(service, 0xff, Buffer.alloc(0), [0x2107]);
            }
            const offset = service === 0x53 ? body.readUInt32LE(headerLength + 2) : 0;
            const data = body.subarray(headerLength + (service === 0x53 ? 6 : 2));
            if (offset + data.length > tag.data.length) return this.reply(service, 0xff, Buffer.alloc(0), [0x2105]);
            data.copy(tag.data, offset);
            return this.reply(service, 0);
        }
        return this.reply(service, 0x08);
    }
}

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

export interface FakeSymbol {
    instance: number;
    name: string;
    type: number;
    elementLength?: number;
    dimensions?: [number, number, number];
    /** 0 read/write, 2 read only, 3 none. */
    externalAccess?: number;
}

export interface FakeTemplate {
    /** Complete reply data of Get Attribute List. */
    attributes: Buffer;
    /** Complete template body. */
    body: Buffer;
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
    readonly templates = new Map<number, FakeTemplate>();
    symbols: FakeSymbol[] = [];
    /** Reply data of Get Attributes All on the identity object. */
    identity: Buffer = Buffer.alloc(0);
    /** Entries per symbol list reply; larger lists are answered with a partial transfer. */
    symbolPageSize = 1000;
    /** When false the symbol list rejects the external access attribute like older firmware does. */
    externalAccess = true;
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
        this.templates.clear();
        this.symbols = [];
        this.identity = Buffer.alloc(0);
        this.symbolPageSize = 1000;
        this.externalAccess = true;
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

    private handleObject(service: number, path: Buffer, body: Buffer, route: Buffer): Buffer {
        const classId = path[1];
        const instanceAt = 2;
        const instance = path[instanceAt] === 0x25 ? path.readUInt16LE(instanceAt + 2) : path[instanceAt + 1];
        this.requests.push({
            service,
            tag: `class 0x${classId.toString(16)} instance ${instance}`,
            route: Buffer.from(route),
        });

        if (classId === 0x01 && service === 0x01) return this.reply(service, 0, this.identity);
        if (classId === 0x6b && service === 0x55) return this.symbolList(service, instance, body);
        if (classId === 0x6c) {
            const template = this.templates.get(instance);
            if (template === undefined) return this.reply(service, 0x05);
            if (service === 0x03) return this.reply(service, 0, template.attributes);
            if (service === 0x4c) {
                const offset = body.readUInt32LE(0);
                const length = Math.min(body.readUInt16LE(4), template.body.length - offset);
                const chunk = template.body.subarray(offset, offset + Math.min(length, this.maxFragment));
                return this.reply(service, offset + chunk.length < offset + length ? 0x06 : 0, chunk);
            }
        }
        return this.reply(service, 0x08);
    }

    private symbolList(service: number, start: number, body: Buffer): Buffer {
        const attributes: number[] = [];
        for (let i = 0; i < body.readUInt16LE(0); i++) attributes.push(body.readUInt16LE(2 + i * 2));
        if (!this.externalAccess && attributes.includes(10)) return this.reply(service, 0x14);

        const remaining = this.symbols.filter((symbol) => symbol.instance >= start);
        const page = remaining.slice(0, this.symbolPageSize);
        const parts: Buffer[] = [];
        for (const symbol of page) {
            const [d1, d2, d3] = symbol.dimensions ?? [0, 0, 0];
            const dimensions = Buffer.alloc(12);
            dimensions.writeUInt32LE(d1, 0);
            dimensions.writeUInt32LE(d2, 4);
            dimensions.writeUInt32LE(d3, 8);
            const name = Buffer.from(symbol.name, "latin1");
            const instance = Buffer.alloc(4);
            instance.writeUInt32LE(symbol.instance);
            parts.push(instance);
            for (const attribute of attributes) {
                if (attribute === 1) parts.push(u16(name.length), name);
                else if (attribute === 2) parts.push(u16(symbol.type));
                else if (attribute === 7) parts.push(u16(symbol.elementLength ?? 0));
                else if (attribute === 8) parts.push(dimensions);
                else if (attribute === 10) parts.push(Buffer.from([symbol.externalAccess ?? 0]));
            }
        }
        return this.reply(service, remaining.length > page.length ? 0x06 : 0, Buffer.concat(parts));
    }

    private handle(request: Buffer, route: Buffer): Buffer {
        const service = request[0];
        const pathEnd = 2 + request[1] * 2;
        if (request[2] === 0x20) {
            return this.handleObject(service, request.subarray(2, pathEnd), request.subarray(pathEnd), route);
        }
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

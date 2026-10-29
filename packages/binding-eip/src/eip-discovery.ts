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
import * as dgram from "dgram";
import * as os from "os";
import { DEFAULT_PORT, eipEndpointUri } from "./eip-address";
import { EipLogixFamily, Identity, logixFamilyOf, parseIdentityFields } from "./eip-symbols";

const LIST_IDENTITY = 0x63;
const HEADER_LENGTH = 24;
const IDENTITY_ITEM = 0x000c;
// Protocol version (2 bytes) and socket address (16 bytes) precede the identity fields of the item.
const IDENTITY_FIELDS_OFFSET = 18;
const DEFAULT_TIMEOUT = 3000;
const DEFAULT_ROUTE_PATH = ["1", "0"];

export interface DiscoveredController {
    host: string;
    port: number;
    /** `eip://host[:port]/1,0/`, ready to be passed to `browseController` or `WoT.requestThingDescription`. */
    baseUri: string;
    identity: Identity;
    /** Set when the product is a Logix controller that can be browsed. */
    controller?: EipLogixFamily;
}

export interface DiscoverOptions {
    /** Send from this local IPv4 address only. By default every non-loopback IPv4 interface is used. */
    localAddress?: string;
    /** Send to this address instead of the subnet broadcast address of each interface. */
    broadcastAddress?: string;
    /** UDP port of the controllers. Defaults to 44818. */
    port?: number;
    /** Time in milliseconds to wait for replies. Defaults to 3000. */
    timeout?: number;
}

/** A ListIdentity request: the 24-byte encapsulation header with every field but the command zero. */
export function encodeListIdentity(): Buffer {
    const message = Buffer.alloc(HEADER_LENGTH);
    message.writeUInt16LE(LIST_IDENTITY, 0);
    return message;
}

/** The identity in a ListIdentity reply, or undefined when the datagram is not a valid reply. */
export function parseListIdentityReply(message: Buffer): Identity | undefined {
    try {
        if (message.length < HEADER_LENGTH + 2) return undefined;
        if (message.readUInt16LE(0) !== LIST_IDENTITY || message.readUInt32LE(8) !== 0) return undefined;
        const data = message.subarray(HEADER_LENGTH, HEADER_LENGTH + message.readUInt16LE(2));
        const items = data.readUInt16LE(0);
        let offset = 2;
        for (let i = 0; i < items; i++) {
            const type = data.readUInt16LE(offset);
            const length = data.readUInt16LE(offset + 2);
            offset += 4;
            if (type === IDENTITY_ITEM) {
                return parseIdentityFields(data.subarray(offset, offset + length), IDENTITY_FIELDS_OFFSET).identity;
            }
            offset += length;
        }
    } catch {
        // A datagram that is cut short is not a reply.
    }
    return undefined;
}

export function subnetBroadcast(address: string, netmask: string): string {
    const ip = address.split(".").map(Number);
    const mask = netmask.split(".").map(Number);
    return ip.map((byte, i) => (byte | (~mask[i] & 0xff)) & 0xff).join(".");
}

interface Target {
    local?: string;
    broadcast: string;
}

function targetsOf(options: DiscoverOptions): Target[] {
    if (options.broadcastAddress !== undefined) {
        return [{ local: options.localAddress, broadcast: options.broadcastAddress }];
    }
    const targets: Target[] = [];
    for (const addresses of Object.values(os.networkInterfaces())) {
        for (const address of addresses ?? []) {
            if (address.family !== "IPv4" || address.internal) continue;
            if (options.localAddress !== undefined && address.address !== options.localAddress) continue;
            targets.push({ local: address.address, broadcast: subnetBroadcast(address.address, address.netmask) });
        }
    }
    if (targets.length === 0 && options.localAddress === undefined) targets.push({ broadcast: "255.255.255.255" });
    return targets;
}

function closeQuietly(socket: dgram.Socket): void {
    try {
        socket.close();
    } catch {
        // already closed after an error
    }
}

/**
 * Finds EtherNet/IP devices with a ListIdentity broadcast on every local IPv4 interface. Devices of any vendor
 * answer. A container needs host networking for the broadcast to leave on the plant network.
 */
export async function discoverControllers(options: DiscoverOptions = {}): Promise<DiscoveredController[]> {
    const port = options.port ?? DEFAULT_PORT;
    const found = new Map<string, DiscoveredController>();
    const errors: Error[] = [];
    const sockets: dgram.Socket[] = [];

    for (const target of targetsOf(options)) {
        const socket = dgram.createSocket("udp4");
        sockets.push(socket);
        socket.on("error", (err) => {
            errors.push(err);
            closeQuietly(socket);
        });
        socket.on("message", (message, sender) => {
            const identity = parseListIdentityReply(message);
            if (identity === undefined || found.has(sender.address)) return;
            found.set(sender.address, {
                host: sender.address,
                port: sender.port,
                baseUri: eipEndpointUri({ host: sender.address, port: sender.port, routePath: DEFAULT_ROUTE_PATH }),
                identity,
                controller: logixFamilyOf(identity),
            });
        });
        socket.bind(0, target.local, () => {
            socket.setBroadcast(true);
            socket.send(encodeListIdentity(), port, target.broadcast, (err) => {
                if (err !== null) errors.push(err);
            });
        });
    }

    await new Promise((resolve) => setTimeout(resolve, options.timeout ?? DEFAULT_TIMEOUT));
    sockets.forEach(closeQuietly);
    if (found.size === 0 && errors.length > 0) throw errors[0];
    return [...found.values()];
}

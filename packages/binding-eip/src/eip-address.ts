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

export const DEFAULT_PORT = 44818;
const DEFAULT_ROUTE_PATH = ["1", "0"];
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export interface EipEndpoint {
    host: string;
    port: number;
    /** CIP route path as port/address pairs, flattened, e.g. ["1", "0"] for backplane slot 0. */
    routePath: string[];
}

export interface EipAddress extends EipEndpoint {
    /** Percent-decoded symbolic tag path. */
    tagPath: string;
    byteOffset: number;
}

function parseRoutePath(raw: string): string[] {
    const parts = raw.split(",");
    if (parts.length % 2 !== 0) {
        throw new Error(`Malformed route path '${raw}': expected port,address pairs`);
    }
    for (let i = 0; i < parts.length; i += 2) {
        const port = parts[i];
        const address = parts[i + 1];
        if (!/^\d+$/.test(port) || parseInt(port, 10) < 1 || parseInt(port, 10) > 65535) {
            throw new Error(`Malformed route path '${raw}': invalid port segment '${port}'`);
        }
        const isSlot = /^\d+$/.test(address) && parseInt(address, 10) <= 255;
        if (!isSlot && !IPV4.test(address)) {
            throw new Error(`Malformed route path '${raw}': invalid address segment '${address}'`);
        }
    }
    return parts;
}

function parseEipUrl(href: string): { url: URL; host: string; port: number } {
    let url: URL;
    try {
        url = new URL(href);
    } catch {
        throw new Error(`Malformed EtherNet/IP href '${href}'`);
    }
    if (url.protocol !== "eip:") {
        throw new Error(`Unsupported scheme '${url.protocol}' in href '${href}', expected 'eip'`);
    }

    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host === "") {
        throw new Error(`Missing host in href '${href}'`);
    }
    const port = url.port === "" ? DEFAULT_PORT : parseInt(url.port, 10);
    return { url, host, port };
}

/** Parses `eip://host[:port][/route-path][/]`, an endpoint without a tag path, as used to browse a controller. */
export function parseEipEndpoint(uri: string): EipEndpoint {
    const { url, host, port } = parseEipUrl(uri);
    const segments = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    if (url.search !== "" || url.hash !== "" || segments.length > 1) {
        throw new Error(`Unexpected tag path, query or fragment in endpoint '${uri}'`);
    }
    if (segments[0] === "") return { host, port, routePath: DEFAULT_ROUTE_PATH };
    if (!/^\d/.test(segments[0])) throw new Error(`Unexpected tag path '${segments[0]}' in endpoint '${uri}'`);
    return { host, port, routePath: parseRoutePath(segments[0]) };
}

/** The `eip://host[:port]/route-path/` URI of an endpoint, usable as the `base` of a Thing Description. */
export function eipEndpointUri(endpoint: EipEndpoint): string {
    const host = endpoint.host.includes(":") ? `[${endpoint.host}]` : endpoint.host;
    const port = endpoint.port === DEFAULT_PORT ? "" : `:${endpoint.port}`;
    return `eip://${host}${port}/${endpoint.routePath.join(",")}/`;
}

/**
 * Splits an absolute eip:// href into endpoint, CIP route path, tag path and byte offset.
 * Logix tag names never start with a digit, so a leading numeric segment is the route path.
 */
export function parseEipHref(href: string): EipAddress {
    const { url, host, port } = parseEipUrl(href);

    const segments = url.pathname.replace(/^\//, "").split("/");
    let routePath = DEFAULT_ROUTE_PATH;
    if (/^\d/.test(segments[0])) {
        routePath = parseRoutePath(segments[0]);
        segments.shift();
    }
    if (segments.length > 1) {
        throw new Error(`Unexpected '/' in tag path of '${href}', encode it as %2F`);
    }
    if (segments.length === 0 || segments[0] === "") {
        throw new Error(`Missing tag path in href '${href}'`);
    }
    let tagPath: string;
    try {
        tagPath = decodeURIComponent(segments[0]);
    } catch {
        throw new Error(`Malformed percent-encoding in tag path of '${href}'`);
    }

    let byteOffset = 0;
    for (const [key, value] of url.searchParams) {
        if (key !== "offset") {
            throw new Error(`Unsupported query parameter '${key}' in href '${href}', only 'offset' is defined`);
        }
        if (!/^\d+$/.test(value)) {
            throw new Error(`Invalid offset '${value}' in href '${href}', expected a non-negative integer`);
        }
        byteOffset = parseInt(value, 10);
    }

    return { host, port, routePath, tagPath, byteOffset };
}

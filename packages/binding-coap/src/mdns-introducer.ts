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

import makeMdns = require("multicast-dns");
import { networkInterfaces } from "os";
import { MulticastDNS } from "multicast-dns";
import { Answer } from "dns-packet";
import { ExposedThing } from "@node-wot/core";

interface MdnsDiscoveryParameters {
    urlPath: string;
    port: number;
    serviceName: string;
    scheme?: string;
    type?: "Thing" | "Directory";
}

type IpAddressFamily = "IPv4" | "IPv6";

/**
 * Implements DNS-based Service Discovery as a TD discovery mechanism
 * using MDNS.
 *
 * @see https://www.w3.org/TR/wot-discovery/#introduction-dns-sd-sec
 */
export class MdnsIntroducer {
    private readonly mdns: MulticastDNS;

    private readonly mdnsEntries: Map<string, Answer[]>;

    private readonly ipAddressFamily: IpAddressFamily;

    constructor(address?: string, ipAddressFamily?: IpAddressFamily) {
        this.ipAddressFamily = ipAddressFamily ?? "IPv4";

        const type = ipAddressFamily === "IPv6" ? "udp6" : "udp4";

        this.mdns = makeMdns({
            ip: address,
            type,
        });
        this.mdnsEntries = new Map();
        this.mdns.on("query", (query) => {
            this.sendMdnsResponses(query);
        });
    }

    private sendMdnsResponses(query: makeMdns.QueryPacket): void {
        this.mdnsEntries.forEach((value) => {
            const entryName = value[0].name;
            const matchingQuestions = query.questions.filter((question) => question.name === entryName);

            if (matchingQuestions.length <= 0) {
                return;
            }

            this.mdns.respond(value);
        });
    }

    private determineTarget(): string {
        const interfaces = networkInterfaces();

        for (const iface of Object.values(interfaces ?? {})) {
            for (const entry of iface ?? []) {
                if (entry.internal === false) {
                    if (entry.family === this.ipAddressFamily) {
                        return entry.address;
                    }
                }
            }
        }

        // TODO: Is it correct to throw an error here?
        throw Error("Found no suitable IP address for performing MDNS introduction.");
    }

    private createTxtData(parameters: MdnsDiscoveryParameters): Array<string> {
        const txtData = [`td=${parameters.urlPath}`];

        const type = parameters.type;
        if (type != null) {
            txtData.push(`type=${type}`);
        }

        const scheme = parameters.scheme;
        if (scheme != null) {
            txtData.push(`scheme=${scheme}`);
        }

        return txtData;
    }

    public registerExposedThing(thing: ExposedThing, parameters: MdnsDiscoveryParameters): void {
        const serviceName = parameters.serviceName;
        const instanceName = `${thing.title}.${serviceName}`;

        const target = this.determineTarget();
        const txtData = this.createTxtData(parameters);

        this.mdnsEntries.set(parameters.urlPath, [
            {
                name: serviceName,
                type: "PTR",
                data: instanceName,
            },
            {
                name: instanceName,
                type: "SRV",
                data: {
                    port: parameters.port,
                    target,
                },
            },
            {
                name: instanceName,
                type: "TXT",
                data: txtData,
            },
        ]);
    }

    public delete(urlPath: string): void {
        this.mdnsEntries.delete(urlPath);
    }

    public async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.mdns.destroy((error?: Error) => {
                if (error != null) {
                    reject(error);
                }
                resolve();
            });
        });
    }
}

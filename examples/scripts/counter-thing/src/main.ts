/********************************************************************************
 * Copyright (c) 2025 Contributors to the Eclipse Foundation
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

import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { createLogger, transports, format } from "winston";
import LokiTransport from "winston-loki";
import dotenv from "dotenv";
import { parseArgs } from "node:util";

dotenv.config();

const hostname = process.env.HOSTNAME ?? "localhost";
let portNumber = process.env.PORT != null && process.env.PORT !== "" ? parseInt(process.env.PORT) : 3000;
const thingName = "counter";

const logger = createLogger({
    transports: [
        new LokiTransport({
            host: `http://${process.env.LOKI_HOSTNAME ?? "localhost"}:${process.env.LOKI_PORT ?? "3100"}`,
            labels: { thing: thingName },
            json: true,
            format: format.json(),
            replaceTimestamp: true,
            onConnectionError: (err: unknown) => console.error(err),
        }),
        new transports.Console({
            format: format.combine(format.simple(), format.colorize()),
        }),
    ],
});

const {
    values: { port },
} = parseArgs({
    options: {
        port: {
            type: "string",
            short: "p",
        },
    },
});

if (port != null && !isNaN(parseInt(port))) {
    portNumber = parseInt(port);
}

// Initialize state
let count = 0;
let lastChange = new Date().toISOString();

const setCount = (value: number) => {
    count = value;
    lastChange = new Date().toISOString();
    logger.info({
        message: `${count}`,
        labels: {
            affordance: "property",
            affordanceName: "count",
            messageType: "updateProperty",
        },
    });
};

const thingDescription = {
    title: "Counter",
    titles: {
        en: "Counter",
        de: "Zähler",
        it: "Contatore",
    },
    description: "Counter example Thing",
    descriptions: {
        en: "Counter example Thing",
        de: "Zähler Beispiel Ding",
        it: "Contatore di esempio",
    },
    support: "https://github.com/eclipse-thingweb/node-wot/",
    links: [
        {
            href: "https://www.thingweb.io/img/favicon/favicon.png",
            sizes: "16x14",
            rel: "icon",
        },
    ],
    "@context": [
        "https://www.w3.org/2019/wot/td/v1",
        "https://www.w3.org/2022/wot/td/v1.1",
        {
            iot: "http://example.org/iot",
        },
    ],
    "@type": "Thing",
    uriVariables: {
        step: {
            type: "integer",
            minimum: 1,
            maximum: 250,
        },
    },
    properties: {
        count: {
            title: "Count",
            titles: {
                en: "Count",
                de: "Zähler",
                it: "Valore",
            },
            type: "integer",
            description: "Current counter value",
            descriptions: {
                en: "Current counter value",
                de: "Derzeitiger Zählerwert",
                it: "Valore attuale del contatore",
            },
            "iot:Custom": "example annotation",
            observable: true,
            readOnly: true,
        },
        countAsImage: {
            description: "Current counter value as SVG image",
            descriptions: {
                en: "Current counter value as SVG image",
                de: "Aktueller Zählerwert als SVG-Bild",
                it: "Valore attuale del contatore come immagine SVG",
            },
            observable: false,
            readOnly: true,
            uriVariables: {
                fill: {
                    type: "string",
                },
            },
            forms: [
                {
                    contentType: "image/svg+xml",
                },
            ],
        },
        redDotImage: {
            description: "Red dot image as PNG",
            descriptions: {
                en: "Red dot image as PNG",
                de: "Rotes Punktbild als PNG",
                it: "Immagine punto rosso come PNG",
            },
            observable: false,
            readOnly: true,
            forms: [
                {
                    contentType: "image/png;base64",
                },
            ],
        },
        lastChange: {
            title: "Last change",
            titles: {
                en: "Last change",
                de: "Letzte Zählerwertänderung",
                it: "Ultima modifica",
            },
            type: "string",
            description: "Last change of counter value",
            descriptions: {
                en: "Last change of counter value",
                de: "Letzte Änderung",
                it: "Ultima modifica del valore",
            },
            observable: true,
            readOnly: true,
        },
    },
    actions: {
        increment: {
            title: "Increment",
            titles: {
                en: "Increment",
                de: "Erhöhen",
                it: "Incrementa",
            },
            description: "Increment counter value",
            descriptions: {
                en: "Increment counter value",
                de: "Zählerwert erhöhen",
                it: "Incrementa il valore del contatore",
            },
        },
        decrement: {
            title: "Decrement",
            titles: {
                en: "Decrement",
                de: "Verringern",
                it: "Decrementa",
            },
            description: "Decrementing counter value",
            descriptions: {
                en: "Decrementing counter value",
                de: "Zählerwert verringern",
                it: "Decrementare il valore del contatore",
            },
        },
        reset: {
            title: "Reset",
            titles: {
                en: "Reset",
                de: "Zurücksetzen",
                it: "Reset",
            },
            description: "Resetting counter value",
            descriptions: {
                en: "Resetting counter value",
                de: "Zählerwert zurücksetzen",
                it: "Resettare il valore del contatore",
            },
        },
    },
    events: {
        change: {
            title: "Changed",
            titles: {
                en: "Changed",
                de: "Geändert",
                it: "Valore modificato",
            },
            description: "Change event",
            descriptions: {
                en: "Change event",
                de: "Änderungsereignis",
                it: "Valore modificato",
            },
        },
    },
};

const servient = new Servient();
servient.addServer(
    new HttpServer({
        baseUri: `http://${hostname}:${portNumber}`,
        port: portNumber,
    })
);

servient.start().then((WoT) => {
    // TypeScript note: thingDescription is a plain JS object matching the WoT TD schema, but may not strictly match the TS type
    WoT.produce(thingDescription as any)
        .then((thing: any) => {
            console.log("Produced " + thing.getThingDescription().title);

            // Set property handlers
            thing.setPropertyReadHandler("count", async () => count);
            thing.setPropertyReadHandler("lastChange", async () => lastChange);
            thing.setPropertyReadHandler("countAsImage", async (options: any) => {
                let fill = "black";
                if (options && typeof options === "object" && "uriVariables" in options) {
                    if (options.uriVariables && "fill" in options.uriVariables) {
                        const uriVariables = options.uriVariables;
                        fill = uriVariables.fill as string;
                    }
                }
                return (
                    "<svg xmlns='http://www.w3.org/2000/svg' height='30' width='200'>" +
                    "<text x='0' y='15' fill='" +
                    fill +
                    "'>" +
                    count +
                    "</text>" +
                    "</svg>"
                );
            });
            thing.setPropertyReadHandler(
                "redDotImage",
                async () =>
                    "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
            );

            // Set action handlers
            thing.setActionHandler("increment", async (params: any, options: any) => {
                let step = 1;
                if (options && typeof options === "object" && "uriVariables" in options) {
                    if (options.uriVariables && "step" in options.uriVariables) {
                        const uriVariables = options.uriVariables;
                        step = uriVariables.step as number;
                    }
                }
                const newValue = count + step;
                logger.info(`Incrementing count from ${count} to ${newValue} (with step ${step})`);
                setCount(newValue);
                thing.emitEvent("change", count);
                thing.emitPropertyChange("count");
                return undefined;
            });

            thing.setActionHandler("decrement", async (params: any, options: any) => {
                let step = 1;
                if (options && typeof options === "object" && "uriVariables" in options) {
                    if (options.uriVariables && "step" in options.uriVariables) {
                        const uriVariables = options.uriVariables;
                        step = uriVariables.step as number;
                    }
                }
                const newValue = count - step;
                logger.info(`Decrementing count from ${count} to ${newValue} (with step ${step})`);
                setCount(newValue);
                thing.emitEvent("change", count);
                thing.emitPropertyChange("count");
                return undefined;
            });

            thing.setActionHandler("reset", async () => {
                logger.info("Resetting count");
                setCount(0);
                thing.emitEvent("change", count);
                thing.emitPropertyChange("count");
                return undefined;
            });

            // Expose the thing
            thing.expose().then(() => {
                logger.info(`${thing.getThingDescription().title} ready`);
            });
        })
        .catch((e) => {
            logger.error(e);
        });
});

/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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
import { DataSchema, InteractionInput } from "wot-typescript-definitions";
import { ContentListener } from "./protocol-interfaces";
import { ThingInteraction } from "./thing-description";
import contentSerdes from "./content-serdes";

export default class ProtocolListenerRegistry {
    private static EMPTY_MAP = new Map();
    private listeners: Map<ThingInteraction, Map<number, ContentListener[]>> = new Map();
    register(affordance: ThingInteraction, formIndex: number, listener: ContentListener): void {
        if (affordance.forms[formIndex] == null) {
            throw new Error(
                "Can't register the listener for affordance with formIndex. The affordance does not contain the form"
            );
        }

        let formMap = this.listeners.get(affordance);

        if (!formMap) {
            formMap = new Map();
            this.listeners.set(affordance, formMap);
        }

        let listeners = formMap.get(formIndex);

        if (!listeners) {
            listeners = [];
            formMap.set(formIndex, listeners);
        }
        listeners.push(listener);
    }

    unregister(affordance: ThingInteraction, formIndex: number, listener: ContentListener): void {
        const formMap = this.listeners.get(affordance);

        if (!formMap) {
            throw new Error("Not found");
        }

        const listeners = formMap.get(formIndex);

        if (!listeners) {
            throw new Error("Form not found");
        }

        const index = listeners.indexOf(listener);

        if (index < 0) {
            throw new Error("Form not found");
        }

        listeners.splice(index, 1);
    }

    unregisterAll(): void {
        this.listeners.clear();
    }

    notify(affordance: ThingInteraction, data: InteractionInput, schema?: DataSchema, formIndex?: number): void {
        const formMap =
            this.listeners.get(affordance) ?? (ProtocolListenerRegistry.EMPTY_MAP as Map<number, ContentListener[]>);

        if (formIndex !== undefined) {
            const listeners = formMap.get(formIndex);
            if (listeners) {
                const contentType = affordance.forms[formIndex].contentType;
                const content = contentSerdes.valueToContent(data, schema, contentType);

                listeners.forEach((listener) => listener(content));
                // formIndex satisfied
                return;
            }
            // we couldn't find any listener for formIndex, defaulting to notify all forms
        }

        for (const [index, value] of formMap) {
            const contentType = affordance.forms[index].contentType;
            const content = contentSerdes.valueToContent(data, schema, contentType);
            value.forEach((listener) => listener(content));
        }
    }
}

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
import { EipEndpoint, eipEndpointUri, parseEipEndpoint } from "./eip-address";
import { EipFieldDefinition, EipForm, EipPrimitiveType, EipStructureDefinition } from "./eip-form";
import { validateEipForm } from "./eip-form-validation";
import { CipReply, EipError, assertCipSuccess } from "./eip-protocol";
import { EipSession } from "./eip-session";
import {
    EXTERNAL_ACCESS_NONE,
    EXTERNAL_ACCESS_READ_ONLY,
    EipLogixFamily,
    SymbolEntry,
    Template,
    encodeIdentityRequest,
    encodeReadTemplate,
    encodeSymbolListRequest,
    encodeTemplateAttributesRequest,
    isArrayMember,
    isPredefinedTemplate,
    isStructureType,
    isSystemType,
    logixFamilyOf,
    memberBaseType,
    parseIdentity,
    parseSymbolEntries,
    parseTemplate,
    parseTemplateAttributes,
    primitiveTypeOf,
    symbolDimensionCount,
    templateIdOf,
    templateReadLength,
} from "./eip-symbols";

const TD_CONTEXT = "https://www.w3.org/2022/wot/td/v1.1";
const EIP_NAMESPACE = "https://www.w3.org/2026/wot/eip";
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_POLLING = 1000;
const PARTIAL_TRANSFER = 0x06;
const ATTRIBUTE_NOT_SUPPORTED = 0x14;

// Entries of the symbol list that are not data tags.
const NOT_A_TAG = /^(Program|Task|Routine|Map|Cxn):|^__/;
// Host members of packed BOOLs, and the control word of predefined types such as TIMER.
const HIDDEN_MEMBER = /^(ZZZZZZZZZZ|__)/;
const PREDEFINED_HIDDEN_MEMBER = /^(CTL|Control)$/;
const STRING_TEMPLATES = ["STRING", "ASCIISTRING82"];

const INTEGER_BOUNDS: Partial<Record<EipPrimitiveType, [number, number]>> = {
    "eipv:SINT": [-128, 127],
    "eipv:INT": [-32768, 32767],
    "eipv:DINT": [-2147483648, 2147483647],
    "eipv:USINT": [0, 255],
    "eipv:UINT": [0, 65535],
    "eipv:UDINT": [0, 4294967295],
    "eipv:BYTE": [0, 255],
    "eipv:WORD": [0, 65535],
    "eipv:DWORD": [0, 4294967295],
};

export interface BrowseOptions {
    /** Thing title. Defaults to the product name of the controller and its host. */
    title?: string;
    /** Thing id. Defaults to an URN built from host, port and route path. */
    id?: string;
    /** Polling interval in milliseconds written into every form. Defaults to 1000. */
    pollingTime?: number;
    /** Response timeout in milliseconds for each request. Defaults to 5000. */
    timeout?: number;
    /** Only tags whose name matches are included. */
    filter?: RegExp | ((name: string) => boolean);
    /** Skips the product check of the identity when the controller is a Logix controller with an unknown name. */
    controller?: EipLogixFamily;
}

export interface SkippedTag {
    name: string;
    reason: string;
}

export interface BrowseResult {
    thingDescription: Record<string, unknown>;
    skipped: SkippedTag[];
}

/** A tag the binding cannot express. It is reported and left out, the browse goes on. */
class UnsupportedTag extends Error {}

interface ElementType {
    type?: EipPrimitiveType;
    structure?: EipStructureDefinition;
}

type LoadedTemplate = Template & { id: number };

function tagHref(name: string): string {
    const encoded = name.replace(/[[\]?#/]/g, (c) => encodeURIComponent(c));
    return name.includes(":") ? `./${encoded}` : encoded;
}

function dataSchema(element: ElementType): Record<string, unknown> {
    if (element.structure !== undefined) return { type: "object" };
    const type = element.type as EipPrimitiveType;
    if (type === "eipv:BOOL") return { type: "boolean" };
    if (type === "eipv:STRING") return { type: "string" };
    if (type === "eipv:REAL" || type === "eipv:LREAL") return { type: "number" };
    const bounds = INTEGER_BOUNDS[type];
    return bounds === undefined ? { type: "integer" } : { type: "integer", minimum: bounds[0], maximum: bounds[1] };
}

function isCustomString(template: Template): boolean {
    const names = template.members.map((member) => member.name);
    return names.length === 2 && names[0] === "LEN" && names[1] === "DATA";
}

/** Reads the tag database of a Logix controller and describes it as a Thing Description. Use one instance per browse. */
export class EipBrowser {
    private readonly templates = new Map<number, LoadedTemplate>();
    private readonly skipped: SkippedTag[] = [];
    private readonly timeout: number;

    constructor(
        private readonly session: EipSession,
        private readonly options: BrowseOptions = {}
    ) {
        this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    }

    async browse(endpoint: EipEndpoint): Promise<BrowseResult> {
        const identity = parseIdentity((await this.request(encodeIdentityRequest(), "Reading the identity")).data);
        const family = this.options.controller ?? logixFamilyOf(identity);
        if (family === undefined) {
            throw new Error(
                `Cannot browse '${identity.productName}': only ControlLogix and CompactLogix controllers are supported`
            );
        }

        const properties: Record<string, unknown> = {};
        for (const entry of await this.listSymbols()) {
            if (isSystemType(entry.type) || NOT_A_TAG.test(entry.name) || !this.included(entry.name)) continue;
            if (entry.externalAccess === EXTERNAL_ACCESS_NONE) {
                this.skipped.push({ name: entry.name, reason: "external access is none" });
                continue;
            }
            try {
                properties[entry.name] = await this.property(entry);
            } catch (err) {
                if (!(err instanceof UnsupportedTag) && !(err instanceof EipError && err.generalStatus !== undefined)) {
                    throw err;
                }
                this.skipped.push({ name: entry.name, reason: err.message });
            }
        }

        const thingDescription = {
            "@context": [TD_CONTEXT, { eipv: EIP_NAMESPACE }],
            id: this.options.id ?? `urn:eip:${[endpoint.host, endpoint.port, ...endpoint.routePath].join(":")}`,
            title: this.options.title ?? `${identity.productName} @ ${endpoint.host}`,
            base: eipEndpointUri(endpoint),
            securityDefinitions: { nosec_sc: { scheme: "nosec" } },
            security: ["nosec_sc"],
            "eipv:controller": family,
            properties,
        };
        return { thingDescription, skipped: this.skipped };
    }

    private included(name: string): boolean {
        const filter = this.options.filter;
        if (filter === undefined) return true;
        if (typeof filter === "function") return filter(name);
        filter.lastIndex = 0;
        return filter.test(name);
    }

    private async request(cip: Buffer, context: string, allowPartial = false): Promise<CipReply> {
        const reply = await this.session.request(cip, this.timeout);
        assertCipSuccess(reply, allowPartial, context);
        return reply;
    }

    private async listSymbols(): Promise<SymbolEntry[]> {
        try {
            return await this.listSymbolPages(true);
        } catch (err) {
            // Controllers of older firmware do not know the external access attribute.
            if (err instanceof EipError && err.generalStatus === ATTRIBUTE_NOT_SUPPORTED) {
                return this.listSymbolPages(false);
            }
            throw err;
        }
    }

    private async listSymbolPages(withExternalAccess: boolean): Promise<SymbolEntry[]> {
        const symbols: SymbolEntry[] = [];
        let next = 0;
        for (;;) {
            const reply = await this.request(
                encodeSymbolListRequest(next, withExternalAccess),
                "Listing the tags",
                true
            );
            const page = parseSymbolEntries(reply.data, withExternalAccess);
            symbols.push(...page);
            if (reply.status !== PARTIAL_TRANSFER) return symbols;
            if (page.length === 0 || page[page.length - 1].instance < next) {
                throw new EipError("Listing the tags failed: the controller made no progress");
            }
            next = page[page.length - 1].instance + 1;
        }
    }

    private async property(entry: SymbolEntry): Promise<Record<string, unknown>> {
        const count = symbolDimensionCount(entry.type);
        const dimensions = count > 0 ? entry.dimensions.slice(0, count) : undefined;
        if (dimensions?.some((size) => size < 1) === true) {
            throw new UnsupportedTag("the controller reports no size for the array dimensions");
        }
        const element = await this.elementType(entry.type);
        const readOnly = entry.externalAccess === EXTERNAL_ACCESS_READ_ONLY;

        const form: EipForm = {
            href: tagHref(entry.name),
            op: readOnly ? ["readproperty", "observeproperty"] : ["readproperty", "observeproperty", "writeproperty"],
            "eipv:pollingTime": this.options.pollingTime ?? DEFAULT_POLLING,
        };
        if (element.type !== undefined) form["eipv:type"] = element.type;
        if (element.structure !== undefined) form["eipv:structureDefinition"] = element.structure;
        if (dimensions !== undefined) form["eipv:dimensions"] = dimensions;
        try {
            validateEipForm(form);
        } catch (err) {
            throw new UnsupportedTag(err instanceof Error ? err.message : String(err));
        }

        const schema = dataSchema(element);
        if (dimensions === undefined) return { ...schema, readOnly, observable: true, forms: [form] };
        const elements = dimensions.reduce((a, b) => a * b, 1);
        return {
            type: "array",
            items: schema,
            minItems: elements,
            maxItems: elements,
            readOnly,
            observable: true,
            forms: [form],
        };
    }

    private async elementType(typeWord: number): Promise<ElementType> {
        if (isSystemType(typeWord)) throw new UnsupportedTag("system types are not supported");
        if (isStructureType(typeWord)) {
            const template = await this.loadTemplate(templateIdOf(typeWord));
            if (STRING_TEMPLATES.includes(template.name)) return { type: "eipv:STRING" };
            if (isCustomString(template)) {
                throw new UnsupportedTag(`the string type ${template.name} is not supported, only STRING is`);
            }
            return { structure: await this.structureDefinition(template) };
        }
        const type = primitiveTypeOf(typeWord);
        if (type === undefined) {
            throw new UnsupportedTag(`CIP type 0x${(typeWord & 0xff).toString(16)} is not supported`);
        }
        return { type };
    }

    private async structureDefinition(template: LoadedTemplate): Promise<EipStructureDefinition> {
        const predefined = isPredefinedTemplate(template.id);
        const fields: EipFieldDefinition[] = [];
        for (const member of template.members) {
            const hidden =
                member.name === "" ||
                HIDDEN_MEMBER.test(member.name) ||
                (predefined && PREDEFINED_HIDDEN_MEMBER.test(member.name));
            if (hidden) continue;
            try {
                fields.push(await this.field(member));
            } catch (err) {
                if (!(err instanceof UnsupportedTag)) throw err;
                throw new UnsupportedTag(`member ${member.name} of ${template.name}: ${err.message}`);
            }
        }
        if (fields.length === 0) throw new UnsupportedTag(`the structure ${template.name} has no usable members`);
        return { "eipv:typeName": template.name, "eipv:fields": fields, "eipv:byteSize": template.structureSize };
    }

    private async field(member: Template["members"][number]): Promise<EipFieldDefinition> {
        const element = await this.elementType(memberBaseType(member.type));
        const field: EipFieldDefinition = {
            "eipv:name": member.name,
            ...(element.type !== undefined ? { "eipv:type": element.type } : {}),
            ...(element.structure !== undefined ? { "eipv:structureDefinition": element.structure } : {}),
            "eipv:byteOffset": member.offset,
        };
        if (element.type === "eipv:BOOL") field["eipv:bitOffset"] = member.info;
        if (isArrayMember(member.type)) field["eipv:dimensions"] = [member.info];
        return field;
    }

    private async loadTemplate(id: number): Promise<LoadedTemplate> {
        const cached = this.templates.get(id);
        if (cached !== undefined) return cached;

        const context = `Reading template ${id}`;
        const attributes = parseTemplateAttributes(
            (await this.request(encodeTemplateAttributesRequest(id), context)).data
        );
        const length = templateReadLength(attributes);
        const chunks: Buffer[] = [];
        let received = 0;
        for (;;) {
            const reply = await this.request(encodeReadTemplate(id, received, length - received), context, true);
            chunks.push(reply.data);
            received += reply.data.length;
            if (reply.status !== PARTIAL_TRANSFER) break;
            if (reply.data.length === 0)
                throw new EipError(`${context} failed: the controller returned an empty fragment`);
        }

        let template: LoadedTemplate;
        try {
            template = { id, ...parseTemplate(attributes, Buffer.concat(chunks)) };
        } catch (err) {
            throw new UnsupportedTag(
                `template ${id} cannot be decoded: ${err instanceof Error ? err.message : String(err)}`
            );
        }
        this.templates.set(id, template);
        return template;
    }
}

/** Browses the controller at `uri` (`eip://host[:port][/route-path/]`) over a session of its own. */
export async function browseController(uri: string, options: BrowseOptions = {}): Promise<BrowseResult> {
    const endpoint = parseEipEndpoint(uri);
    const session = new EipSession(endpoint);
    try {
        return await new EipBrowser(session, options).browse(endpoint);
    } finally {
        session.close();
    }
}

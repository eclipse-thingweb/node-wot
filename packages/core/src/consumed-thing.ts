/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

import { ConsumedThing as IConsumedThing, InteractionInput, Subscription } from "wot-typescript-definitions";

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import Helpers from "./helpers";

import { ProtocolClient } from "./protocol-interfaces";

import ContentManager from "./content-serdes";

import UriTemplate = require("uritemplate");
import { InteractionOutput } from "./interaction-output";
import {
    ActionElement,
    EventElement,
    FormElementEvent,
    FormElementProperty,
    PropertyElement,
} from "wot-thing-description-types";
import { ThingInteraction } from "@node-wot/td-tools";
import { createLoggers } from "./logger";

const { debug, warn } = createLoggers("core", "consumed-thing");

enum Affordance {
    PropertyAffordance,
    ActionAffordance,
    EventAffordance,
}

export interface ClientAndForm {
    client: ProtocolClient;
    form?: TD.Form;
}

class ConsumedThingProperty extends TD.ThingProperty implements TD.ThingProperty, TD.BaseSchema {
    #name: string;
    #thing: ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        this.#name = name;
        this.#thing = thing;
    }
}

class ConsumedThingAction extends TD.ThingAction implements TD.ThingAction {
    #name: string;
    #thing: ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        this.#name = name;
        this.#thing = thing;
    }
}

class ConsumedThingEvent extends TD.ThingEvent {
    #name: string;
    #thing: ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        this.#name = name;
        this.#thing = thing;
    }
}

/**
 * Describe a subscription with the underling platform
 * @experimental
 */
abstract class InternalSubscription implements Subscription {
    active: boolean;

    constructor(
        protected readonly thing: ConsumedThing,
        protected readonly name: string,
        protected readonly client: ProtocolClient
    ) {
        this.active = true;
    }

    abstract stop(options?: WoT.InteractionOptions): Promise<void>;
}

function handleUriVariables(
    thing: ConsumedThing,
    ti: ThingInteraction,
    form: TD.Form,
    options?: WoT.InteractionOptions
): TD.Form {
    const ut = UriTemplate.parse(form.href);
    const uriVariables = Helpers.parseInteractionOptions(thing, ti, options).uriVariables;
    const updatedHref = ut.expand(uriVariables ?? {});
    if (updatedHref !== form.href) {
        // create shallow copy and update href
        const updForm = { ...form };
        updForm.href = updatedHref;
        form = updForm;
        debug(`ConsumedThing '${thing.title}' update form URI to ${form.href}`);
    }

    return form;
}

class InternalPropertySubscription extends InternalSubscription {
    active = false;
    private formIndex: number;
    constructor(
        thing: ConsumedThing,
        name: string,
        client: ProtocolClient,
        private readonly form: FormElementProperty
    ) {
        super(thing, name, client);
        const index = this.thing.properties?.[name].forms.indexOf(form as TD.Form);
        if (index === undefined || index < 0) {
            throw new Error(`Could not find form ${form.href} in property ${name}`);
        }
        this.formIndex = index;
    }

    async stop(options?: WoT.InteractionOptions): Promise<void> {
        await this.unobserveProperty(options);
        // eslint-disable-next-line dot-notation
        this.thing["observedProperties"].delete(this.name);
    }

    public async unobserveProperty(options: WoT.InteractionOptions = {}): Promise<void> {
        const tp = this.thing.properties[this.name];
        if (tp == null) {
            throw new Error(`ConsumedThing '${this.thing.title}' does not have property ${this.name}`);
        }
        options.formIndex ??= this.matchingUnsubscribeForm();
        const { form } = this.thing.getClientFor(tp.forms, "unobserveproperty", Affordance.PropertyAffordance, options);
        if (form == null) {
            throw new Error(`ConsumedThing '${this.thing.title}' did not get suitable form`);
        }

        const formWithoutURIvariables = handleUriVariables(this.thing, tp, form, options);
        debug(`ConsumedThing '${this.thing.title}' unobserving to ${form.href}`);
        await this.client.unlinkResource(formWithoutURIvariables);
        this.active = false;
    }

    private matchingUnsubscribeForm(): number {
        const refForm = this.thing.properties[this.name].forms[this.formIndex];
        if (Array.isArray(refForm.op) && refForm.op.includes("unobserveproperty")) {
            // we can re-use the same form for unsubscribe
            return this.formIndex;
        }
        // we have to find a matching form for unsubscribe
        const bestFormMatch = this.findFormIndexWithScoring(
            this.formIndex,
            this.thing.properties[this.name].forms,
            "unobserveproperty"
        );

        if (bestFormMatch === -1) {
            throw new Error(`Could not find matching form for unsubscribe`);
        }

        return bestFormMatch;
    }

    /*
     * Find the form index with the best matching score.
     * Implementation of https://w3c.github.io/wot-scripting-api/#dfn-find-a-matching-unsubscribe-form
     */
    private findFormIndexWithScoring(
        formIndex: number,
        forms: TD.Form[],
        operation: "unsubscribeevent" | "unobserveproperty"
    ): number {
        const refForm = forms[formIndex];
        let maxScore = 0;
        let maxScoreIndex = -1;

        for (let i = 0; i < forms.length; i++) {
            let score = 0;
            const form = forms[i];
            if (form.op === operation || (form?.op?.includes(operation) === true && Array.isArray(form.op) === true)) {
                score += 1;
            }

            if (new URL(form.href).origin === new URL(refForm.href).origin) {
                score += 1;
            }

            if (form.contentType === refForm.contentType) {
                score += 1;
            }

            if (score > maxScore) {
                maxScore = score;
                maxScoreIndex = i;
            }
        }
        return maxScoreIndex;
    }
}

/*
 * Find the form index with the best matching score.
 * Implementation of https://w3c.github.io/wot-scripting-api/#dfn-find-a-matching-unsubscribe-form
 */
function findFormIndexWithScoring(
    formIndex: number,
    forms: TD.Form[],
    operation: "unsubscribeevent" | "unobserveproperty"
): number {
    const refForm = forms[formIndex];
    let maxScore = 0;
    let maxScoreIndex = -1;

    for (let i = 0; i < forms.length; i++) {
        let score = 0;
        const form = forms[i];
        if (form.op === operation || (form?.op?.includes(operation) === true && Array.isArray(form.op) === true)) {
            score += 1;
        }

        if (new URL(form.href).origin === new URL(refForm.href).origin) {
            score += 1;
        }

        if (form.contentType === refForm.contentType) {
            score += 1;
        }

        if (score > maxScore) {
            maxScore = score;
            maxScoreIndex = i;
        }
    }
    return maxScoreIndex;
}

class InternalEventSubscription extends InternalSubscription {
    private formIndex: number;
    constructor(thing: ConsumedThing, name: string, client: ProtocolClient, private readonly form: FormElementEvent) {
        super(thing, name, client);
        const index = this.thing.events?.[name].forms.indexOf(form as TD.Form);
        if (index === undefined || index < 0) {
            throw new Error(`Could not find form ${form.href} in event ${name}`);
        }
        this.formIndex = index;
    }

    async stop(options?: WoT.InteractionOptions): Promise<void> {
        await this.unsubscribeEvent(options);
        // eslint-disable-next-line dot-notation
        this.thing["subscribedEvents"].delete(this.name);
    }

    public async unsubscribeEvent(options: WoT.InteractionOptions = {}): Promise<void> {
        const te = this.thing.events[this.name];
        if (te == null) {
            throw new Error(`ConsumedThing '${this.thing.title}' does not have event ${this.name}`);
        }

        options.formIndex ??= this.matchingUnsubscribeForm();

        const { form } = this.thing.getClientFor(te.forms, "unsubscribeevent", Affordance.EventAffordance, options);
        if (form == null) {
            throw new Error(`ConsumedThing '${this.thing.title}' did not get suitable form`);
        }

        const formWithoutURIvariables = handleUriVariables(this.thing, te, form, options);
        debug(`ConsumedThing '${this.thing.title}' unsubscribing to ${form.href}`);
        this.client.unlinkResource(formWithoutURIvariables);
        this.active = false;
    }

    private matchingUnsubscribeForm(): number {
        const refForm = this.thing.events[this.name].forms[this.formIndex];
        // Here we have to keep in mind that op default is ["subscribeevent", "unsubscribeevent"]
        if (refForm.op == null || (Array.isArray(refForm.op) && refForm.op.includes("unsubscribeevent"))) {
            // we can re-use the same form for unsubscribe
            return this.formIndex;
        }
        // we have to find a matching form for unsubscribe
        const bestFormMatch = findFormIndexWithScoring(
            this.formIndex,
            this.thing.events[this.name].forms,
            "unsubscribeevent"
        );

        if (bestFormMatch === -1) {
            throw new Error(`Could not find matching form for unsubscribe`);
        }

        return bestFormMatch;
    }
}

export default class ConsumedThing extends TD.Thing implements IConsumedThing {
    /** A map of interactable Thing Properties with read()/write()/subscribe() functions */
    properties: {
        [key: string]: PropertyElement;
    };

    /** A map of interactable Thing Actions with invoke() function */
    actions: {
        [key: string]: ActionElement;
    };

    /** A map of interactable Thing Events with subscribe() function */
    events: {
        [key: string]: EventElement;
    };

    /**
     * The servient associated with this {@link ConsumedThing}.
     *
     * Provides protocol-specific clients as well as credentials for the
     * available security schemes.
     *
     * The declaration as private (via the leading `#`) prevents this
     * field from being included in the TD generated by the
     * {@link getThingDescription} method.
     */
    #servient: Servient;

    /**
     * Mapping of URI schemes to {@link ProtocolClient}s that are used for
     * performing protocol-specific interactions.
     *
     * The declaration as private (via the leading `#`) prevents this
     * field from being included in the TD generated by the
     * {@link getThingDescription} method.
     */
    #clients: Map<string, ProtocolClient>;

    private subscribedEvents: Map<string, Subscription> = new Map<string, Subscription>();
    private observedProperties: Map<string, Subscription> = new Map<string, Subscription>();

    constructor(servient: Servient, thingModel: TD.ThingModel = {}) {
        super();

        this.#servient = servient;
        this.#clients = new Map();

        this.properties = {};
        this.actions = {};
        this.events = {};

        const deepClonedModel = structuredClone(thingModel);
        Object.assign(this, deepClonedModel);
        this.extendInteractions();
    }

    getThingDescription(): WoT.ThingDescription {
        return JSON.parse(JSON.stringify(this));
    }

    public emitEvent(name: string, data: InteractionInput): void {
        warn("not implemented");
    }

    extendInteractions(): void {
        for (const propertyName in this.properties) {
            const newProp = Helpers.extend(
                this.properties[propertyName],
                new ConsumedThingProperty(propertyName, this)
            );
            this.properties[propertyName] = newProp;
        }
        for (const actionName in this.actions) {
            const newAction = Helpers.extend(this.actions[actionName], new ConsumedThingAction(actionName, this));
            this.actions[actionName] = newAction;
        }
        for (const eventName in this.events) {
            const newEvent = Helpers.extend(this.events[eventName], new ConsumedThingEvent(eventName, this));
            this.events[eventName] = newEvent;
        }
    }

    findForm(
        forms: Array<TD.Form>,
        op: string,
        affordance: Affordance,
        schemes: string[],
        idx: number
    ): TD.Form | undefined {
        let form;

        // find right operation and corresponding scheme in the array form
        for (const f of forms) {
            let fop: string | Array<string> = "";
            if (f.op !== undefined) {
                fop = f.op;
            } else {
                // default "op" values
                // see https://w3c.github.io/wot-thing-description/#sec-default-values
                switch (affordance) {
                    case Affordance.PropertyAffordance:
                        fop = ["readproperty", "writeproperty"];
                        break;
                    case Affordance.ActionAffordance:
                        fop = "invokeaction";
                        break;
                    case Affordance.EventAffordance:
                        fop = "subscribeevent";
                        break;
                }
            }
            if (fop.indexOf(op) !== -1 && f.href.indexOf(schemes[idx] + ":") !== -1) {
                form = f;
                break;
            }
        }

        // Note: form can be undefined if no appropriate op can be found
        return form;
    }

    getSecuritySchemes(security: Array<string>): Array<TD.SecurityScheme> {
        const scs: Array<TD.SecurityScheme> = [];
        for (const s of security) {
            const ws = this.securityDefinitions[s + ""]; // String vs. string (fix wot-typescript-definitions?)
            // also push nosec in case of proxy
            if (ws != null) {
                scs.push(ws);
            }
        }
        return scs;
    }

    ensureClientSecurity(client: ProtocolClient, form: TD.Form | undefined): void {
        if (this.securityDefinitions != null) {
            const logStatement = () =>
                debug(`ConsumedThing '${this.title}' setting credentials for ${client} based on thing security`);

            if (form != null && Array.isArray(form.security) && form.security.length > 0) {
                // Note security member in form objects overrides (i.e., completely replace) all definitions activated at the Thing level
                // see https://www.w3.org/TR/wot-thing-description/#security-serialization-json

                logStatement();
                client.setSecurity(this.getSecuritySchemes(form.security), this.#servient.retrieveCredentials(this.id));
            } else if (Array.isArray(this.security) && this.security.length > 0) {
                logStatement();
                client.setSecurity(
                    this.getSecuritySchemes(this.security as string[]),
                    this.#servient.getCredentials(this.id)
                );
            }
        }
    }

    // utility for Property, Action, and Event
    getClientFor(
        forms: Array<TD.Form>,
        op: string,
        affordance: Affordance,
        options?: WoT.InteractionOptions
    ): ClientAndForm {
        if (forms.length === 0) {
            throw new Error(`ConsumedThing '${this.title}' has no links for this interaction`);
        }

        let form: TD.Form | undefined;
        let client: ProtocolClient;

        if (options?.formIndex !== undefined) {
            // pick provided formIndex (if possible)
            debug(`ConsumedThing '${this.title}' asked to use formIndex '${options.formIndex}'`);

            if (options.formIndex >= 0 && options.formIndex < forms.length) {
                form = forms[options.formIndex];
                const scheme = Helpers.extractScheme(form.href);
                if (this.#servient.hasClientFor(scheme)) {
                    debug(`ConsumedThing '${this.title}' got client for '${scheme}'`);
                    client = this.#servient.getClientFor(scheme);

                    if (!this.#clients.get(scheme)) {
                        // new client
                        this.ensureClientSecurity(client, form);
                        this.#clients.set(scheme, client);
                    }
                } else {
                    throw new Error(`ConsumedThing '${this.title}' missing ClientFactory for '${scheme}'`);
                }
            } else {
                throw new Error(`ConsumedThing '${this.title}' missing formIndex '${options.formIndex}'`);
            }
        } else {
            const schemes = forms.map((link) => Helpers.extractScheme(link.href));
            const cacheIdx = schemes.findIndex((scheme) => this.#clients.has(scheme));

            if (cacheIdx !== -1) {
                // from cache
                debug(`ConsumedThing '${this.title}' chose cached client for '${schemes[cacheIdx]}'`);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- if cacheIdx is valid, then clients *contains* schemes[cacheIdx]
                client = this.#clients.get(schemes[cacheIdx])!;
                form = this.findForm(forms, op, affordance, schemes, cacheIdx);
            } else {
                // new client
                debug(`ConsumedThing '${this.title}' has no client in cache (${cacheIdx})`);
                const srvIdx = schemes.findIndex((scheme) => this.#servient.hasClientFor(scheme));

                if (srvIdx === -1)
                    throw new Error(`ConsumedThing '${this.title}' missing ClientFactory for '${schemes}'`);

                client = this.#servient.getClientFor(schemes[srvIdx]);

                debug(`ConsumedThing '${this.title}' got new client for '${schemes[srvIdx]}'`);

                this.#clients.set(schemes[srvIdx], client);

                form = this.findForm(forms, op, affordance, schemes, srvIdx);
                this.ensureClientSecurity(client, form);
            }
        }
        return { client, form };
    }

    async readProperty(propertyName: string, options?: WoT.InteractionOptions): Promise<WoT.InteractionOutput> {
        // TODO pass expected form op to getClientFor()
        const tp = this.properties[propertyName];
        if (tp == null) {
            throw new Error(`ConsumedThing '${this.title}' does not have property ${propertyName}`);
        }

        let { client, form } = this.getClientFor(tp.forms, "readproperty", Affordance.PropertyAffordance, options);
        if (form == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable form`);
        }
        if (client == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`);
        }
        debug(`ConsumedThing '${this.title}' reading ${form.href}`);

        // uriVariables ?
        form = this.handleUriVariables(tp, form, options);

        const content = await client.readResource(form);
        return new InteractionOutput(content, form, tp);
    }

    async _readProperties(propertyNames: string[]): Promise<WoT.PropertyReadMap> {
        // collect all single promises into array
        const promises: Promise<WoT.InteractionOutput>[] = [];
        for (const propertyName of propertyNames) {
            promises.push(this.readProperty(propertyName));
        }
        // wait for all promises to succeed and create response
        const output = new Map<string, WoT.InteractionOutput>();
        try {
            const result = await Promise.all(promises);
            let index = 0;
            for (const propertyName of propertyNames) {
                output.set(propertyName, result[index]);
                index++;
            }
            return output;
        } catch (err) {
            throw new Error(
                `ConsumedThing '${this.title}', failed to read properties: ${propertyNames}.\n Error: ${err}`
            );
        }
    }

    readAllProperties(options?: WoT.InteractionOptions): Promise<WoT.PropertyReadMap> {
        const propertyNames: string[] = [];
        for (const propertyName in this.properties) {
            // collect attributes that are "readable" only
            const tp = this.properties[propertyName];
            const { form } = this.getClientFor(tp.forms, "readproperty", Affordance.PropertyAffordance, options);
            if (form != null) {
                propertyNames.push(propertyName);
            }
        }
        return this._readProperties(propertyNames);
    }

    readMultipleProperties(propertyNames: string[], options?: WoT.InteractionOptions): Promise<WoT.PropertyReadMap> {
        return this._readProperties(propertyNames);
    }

    async writeProperty(
        propertyName: string,
        value: WoT.InteractionInput,
        options?: WoT.InteractionOptions
    ): Promise<void> {
        // TODO pass expected form op to getClientFor()
        const tp = this.properties[propertyName];
        if (tp == null) {
            throw new Error(`ConsumedThing '${this.title}' does not have property ${propertyName}`);
        }
        let { client, form } = this.getClientFor(tp.forms, "writeproperty", Affordance.PropertyAffordance, options);
        if (form == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable form`);
        }
        if (client == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`);
        }
        debug(`ConsumedThing '${this.title}' writing ${form.href} with '${value}'`);

        const content = ContentManager.valueToContent(value, tp, form.contentType);

        // uriVariables ?
        form = this.handleUriVariables(tp, form, options);
        await client.writeResource(form, content);
    }

    async writeMultipleProperties(valueMap: WoT.PropertyWriteMap, options?: WoT.InteractionOptions): Promise<void> {
        // collect all single promises into array
        const promises: Promise<void>[] = [];
        for (const propertyName in valueMap) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const value = valueMap.get(propertyName)!;
            promises.push(this.writeProperty(propertyName, value));
        }
        // wait for all promises to succeed and create response
        try {
            await Promise.all(promises);
        } catch (err) {
            throw new Error(
                `ConsumedThing '${this.title}', failed to write multiple propertes: ${valueMap}\n Error: ${err}`
            );
        }
    }

    public async invokeAction(
        actionName: string,
        parameter?: InteractionInput,
        options?: WoT.InteractionOptions
    ): Promise<WoT.InteractionOutput> {
        const ta = this.actions[actionName];
        if (ta == null) {
            throw new Error(`ConsumedThing '${this.title}' does not have action ${actionName}`);
        }
        let { client, form } = this.getClientFor(ta.forms, "invokeaction", Affordance.ActionAffordance, options);
        if (form == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable form`);
        }
        if (client == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`);
        }
        debug(
            `ConsumedThing '${this.title}' invoking ${form.href}${
                parameter !== undefined ? " with '" + parameter + "'" : ""
            }`
        );

        let input;

        if (parameter !== undefined) {
            input = ContentManager.valueToContent(parameter, ta.input, form.contentType);
        }

        // uriVariables ?
        form = this.handleUriVariables(ta, form, options);

        const content = await client.invokeResource(form, input);
        // infer media type from form if not in response metadata
        if (!content.type) content.type = form.contentType ?? "application/json";

        // check if returned media type is the same as expected media type (from TD)
        if (form.response != null) {
            if (content.type !== form.response.contentType) {
                throw new Error(`Unexpected type in response`);
            }
        }
        try {
            return new InteractionOutput(content, form, ta.output);
        } catch {
            throw new Error(`Received invalid content from Thing`);
        }
    }

    /**
     * @inheritdoc
     * @experimental
     */
    public async observeProperty(
        name: string,
        listener: WoT.WotListener,
        errorListener?: WoT.ErrorListener,
        options?: WoT.InteractionOptions
    ): Promise<Subscription> {
        const tp = this.properties[name];
        if (tp == null) {
            throw new Error(`ConsumedThing '${this.title}' does not have property ${name}`);
        }
        const { client, form } = this.getClientFor(tp.forms, "observeproperty", Affordance.PropertyAffordance, options);
        if (form == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable form`);
        }
        if (client == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`);
        }
        if (this.observedProperties.has(name)) {
            throw new Error(
                `ConsumedThing '${this.title}' has already a function subscribed to ${name}. You can only observe once`
            );
        }
        debug(`ConsumedThing '${this.title}' observing to ${form.href}`);

        // uriVariables ?
        const formWithoutURITemplates = this.handleUriVariables(tp, form, options);

        await client.subscribeResource(
            formWithoutURITemplates,
            // next
            (content) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- tsc get confused when nullables are to listeners lambdas
                if (!content.type) content.type = form!.contentType ?? "application/json";
                try {
                    listener(new InteractionOutput(content, form, tp));
                } catch (e) {
                    warn(`Error while processing observe event for ${tp.title}`);
                    warn(e);
                }
            },
            // error
            (err) => {
                errorListener?.(err);
            },
            // complete
            () => {
                /* TODO: current scripting api cannot handle this */
            }
        );
        const subscription = new InternalPropertySubscription(this, name, client, form as FormElementProperty);
        this.observedProperties.set(name, subscription);
        return subscription;
    }

    /**
     * @inheritdoc
     * @experimental
     */
    public async subscribeEvent(
        name: string,
        listener: WoT.WotListener,
        errorListener?: WoT.ErrorListener,
        options?: WoT.InteractionOptions
    ): Promise<Subscription> {
        const te = this.events[name];
        if (te == null) {
            throw new Error(`ConsumedThing '${this.title}' does not have event ${name}`);
        }
        const { client, form } = this.getClientFor(te.forms, "subscribeevent", Affordance.EventAffordance, options);
        if (form == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable form`);
        }
        if (client == null) {
            throw new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`);
        }
        if (this.subscribedEvents.has(name)) {
            throw new Error(
                `ConsumedThing '${this.title}' has already a function subscribed to ${name}. You can only subscribe once`
            );
        }
        debug(`ConsumedThing '${this.title}' subscribing to ${form.href}`);

        // uriVariables ?
        const formWithoutURITemplates = this.handleUriVariables(te, form, options);

        await client.subscribeResource(
            formWithoutURITemplates,
            (content) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- tsc get confused when nullables are to listeners lambdas
                if (!content.type) content.type = form!.contentType ?? "application/json";
                try {
                    listener(new InteractionOutput(content, form, te.data));
                } catch (e) {
                    warn(`Error while processing event for ${te.title}`);
                    warn(e);
                }
            },
            // error
            (err) => {
                errorListener?.(err);
            },
            // complete
            () => {
                /* TODO: current scripting api cannot handle this */
            }
        );

        const subscription = new InternalEventSubscription(this, name, client, form as FormElementEvent);
        this.subscribedEvents.set(name, subscription);
        return subscription;
    }

    // creates new form (if needed) for URI Variables
    // http://192.168.178.24:8080/counter/actions/increment{?step} with options {uriVariables: {'step' : 3}} --> http://192.168.178.24:8080/counter/actions/increment?step=3
    // see RFC6570 (https://tools.ietf.org/html/rfc6570) for URI Template syntax
    handleUriVariables(ti: ThingInteraction, form: TD.Form, options?: WoT.InteractionOptions): TD.Form {
        return handleUriVariables(this, ti, form, options);
    }
}

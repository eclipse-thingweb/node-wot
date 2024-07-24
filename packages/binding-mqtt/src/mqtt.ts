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

/**
 * Protocol test suite to test protocol implementations
 */

import { Form } from "@node-wot/core";

export { default as MqttClient } from "./mqtt-client";
export { default as MqttClientFactory } from "./mqtt-client-factory";
export { default as MqttsClientFactory } from "./mqtts-client-factory";
export { default as MqttBrokerServer } from "./mqtt-broker-server";

export * from "./mqtt-client";
export * from "./mqtt-client-factory";
export * from "./mqtts-client-factory";
export * from "./mqtt-broker-server";

export type MqttQoS = "0" | "1" | "2";
export class MqttForm extends Form {
    public "mqv:qos"?: MqttQoS = "0";
    public "mqv:retain"?: boolean;

    public "mqv:topic"?: string;

    public "mqv:filter"?: string | string[];

    public "mqv:controlPacket"?: "publish" | "subscribe" | "unsubscribe";
}

export interface MqttClientConfig {
    // username & password are redundant here (also find them in MqttClientSecurityParameters)
    // because MqttClient.setSecurity() method can inject authentication credentials into this interface
    // which will be then passed to mqtt.connect() once for all
    username?: string;
    password?: string;
    rejectUnauthorized?: boolean;
}

export interface MqttBrokerServerConfig {
    uri: string;
    user?: string;
    psw?: string;
    clientId?: string;
    protocolVersion?: 3 | 4 | 5;
    rejectUnauthorized?: boolean;
    selfHost?: boolean;
    key?: Buffer;
    cert?: Buffer | undefined;
    selfHostAuthentication?: MqttClientConfig[];
}

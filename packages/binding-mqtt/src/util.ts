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
import { createLoggers } from "@node-wot/core";
import { MqttQoS } from "./mqtt";
import { IClientPublishOptions } from "mqtt";

const { debug, warn } = createLoggers("binding-mqtt", "mqtt-util");

export function mapQoS(qos: MqttQoS | undefined): Required<IClientPublishOptions>["qos"] {
    switch (qos) {
        case "0":
            return 0;
        case "1":
            return 1;
        case "2":
            return 2;
        case undefined:
            return 0;
        default:
            warn(`MqttClient received unsupported QoS level '${qos}'`);
            warn(`MqttClient falling back to QoS level '0'`);
            return 0;
    }
}

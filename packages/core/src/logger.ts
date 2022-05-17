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

export enum LogLevel {
    Info,
    Debug,
    Warn,
    Error,
    None,
}

let currentLogLevel: LogLevel = LogLevel.None;

export function setLogLevel(logLevel: LogLevel): void {
    currentLogLevel = logLevel;
}

function logInfo(message: string) {
    console.log(message);
}

function logDebug(message: string) {
    console.log(message);
}

function logWarn(message: string) {
    console.log(message);
}

function logError(message: string) {
    console.log(message);
}

export function log(logLevel: LogLevel, prefix: string, message: string): void {
    if (currentLogLevel > logLevel || logLevel === LogLevel.None) {
        return;
    }

    const logMessage = `[${prefix}] ${message}`;

    switch (logLevel) {
        case LogLevel.Info:
            logInfo(logMessage);
            break;
        case LogLevel.Debug:
            logDebug(logMessage);
            break;
        case LogLevel.Warn:
            logWarn(logMessage);
            break;
        case LogLevel.Error:
            logError(logMessage);
            break;
    }
}

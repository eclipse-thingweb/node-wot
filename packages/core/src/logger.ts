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

enum InternalLogLevel {
    Info,
    Debug,
    Warn,
    Error,
    None,
}

export enum LogLevel {
    Info,
    Debug,
    Warn,
    Error,
}

let currentLogLevel: InternalLogLevel = InternalLogLevel.None;

export function setLogLevel(logLevel: LogLevel): void {
    switch (logLevel) {
        case LogLevel.Info:
            currentLogLevel = InternalLogLevel.Info;
            break;
        case LogLevel.Debug:
            currentLogLevel = InternalLogLevel.Debug;
            break;
        case LogLevel.Warn:
            currentLogLevel = InternalLogLevel.Warn;
            break;
        case LogLevel.Error:
            currentLogLevel = InternalLogLevel.Error;
            break;
    }
}

export function disableLogging(): void {
    currentLogLevel = InternalLogLevel.None;
}

function printInfo(message: string) {
    console.info(message);
}

function printDebug(message: string) {
    console.log(message);
}

function printWarn(message: string) {
    console.warn(message);
}

function printError(message: string) {
    console.error(message);
}

function log(logLevel: InternalLogLevel, prefix: string, message: string): void {
    if (currentLogLevel > logLevel || logLevel === InternalLogLevel.None) {
        return;
    }

    const logMessage = `[${prefix}] ${message}`;

    switch (logLevel) {
        case InternalLogLevel.Info:
            printInfo(logMessage);
            break;
        case InternalLogLevel.Debug:
            printDebug(logMessage);
            break;
        case InternalLogLevel.Warn:
            printWarn(logMessage);
            break;
        case InternalLogLevel.Error:
            printError(logMessage);
            break;
    }
}

export function logInfo(prefix: string, message: string): void {
    log(InternalLogLevel.Info, prefix, message);
}

export function logDebug(prefix: string, message: string): void {
    log(InternalLogLevel.Debug, prefix, message);
}

export function logWarn(prefix: string, message: string): void {
    log(InternalLogLevel.Warn, prefix, message);
}

export function logError(prefix: string, message: string): void {
    log(InternalLogLevel.Error, prefix, message);
}

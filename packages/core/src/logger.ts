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

/**
 * The four possible log levels, which have a strict hierachy, where
 * `Info` is the lowest value and `Error` is the highest one.
 *
 * Calling a logging function will only result in a processed
 * log message if the current log level or the log level defined
 * for a prefix is at least as high as the log level associated with
 * the logging function.
 *
 * For example, calling `logInfo` when the the current log level is set
 * to `Debug` will result in no operation. Calling `logDebug` when the
 * log level is set to `Info`, however, will result in a processed debug
 * message.
 */
export enum LogLevel {
    Info,
    Debug,
    Warn,
    Error,
}

let globalLogLevel: InternalLogLevel = InternalLogLevel.None;

const logLevelsByPrefix: Record<string, InternalLogLevel> = {};

function updateLogLevel(logLevel: InternalLogLevel, prefix?: string): void {
    if (prefix == null) {
        globalLogLevel = logLevel;
    } else {
        logLevelsByPrefix[prefix] = logLevel;
    }
}

/**
 * Sets a new log level either globally or, when defined, for a specific prefix.
 *
 * @param logLevel The new log level value.
 * @param prefix The optional prefix for which the log level should be set.
 */
export function setLogLevel(logLevel: LogLevel, prefix?: string): void {
    let internalLogLevel: InternalLogLevel;
    switch (logLevel) {
        case LogLevel.Info:
            internalLogLevel = InternalLogLevel.Info;
            break;
        case LogLevel.Debug:
            internalLogLevel = InternalLogLevel.Debug;
            break;
        case LogLevel.Warn:
            internalLogLevel = InternalLogLevel.Warn;
            break;
        case LogLevel.Error:
            internalLogLevel = InternalLogLevel.Error;
            break;
    }
    updateLogLevel(internalLogLevel, prefix);
}

/**
 * Disables logging either globally or, when defined,
 * for a specific prefix.
 *
 * @param prefix The optional prefix for which the log level should be reset.
 */
export function disableLogging(prefix?: string): void {
    if (logLevelsByPrefix[prefix] != null) {
        logLevelsByPrefix[prefix] = InternalLogLevel.None;
    } else {
        globalLogLevel = InternalLogLevel.None;
    }
}

/**
 * Resets the log level for a given prefix to the global log level.
 *
 * @param prefix The prefix for which the log level should be reset.
 */
export function resetLoglevelForPrefix(prefix: string): void {
    logLevelsByPrefix[prefix] = undefined;
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
    const logLevelToCheck = logLevelsByPrefix[prefix] ?? globalLogLevel;

    if (logLevelToCheck > logLevel || logLevelToCheck === InternalLogLevel.None) {
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

/**
 * Creates a new log message with log level `Info`.
 *
 * The prefix will be wrapped in square brackets in the resulting log message.
 *
 * @param prefix The prefix used for the message.
 * @param message The actual content of the log message.
 */
export function logInfo(prefix: string, message: string): void {
    log(InternalLogLevel.Info, prefix, message);
}

/**
 * Creates a new log message with log level `Debug`.
 *
 * The prefix will be wrapped in square brackets in the resulting log message.
 *
 * @param prefix The prefix used for the message.
 * @param message The actual content of the log message.
 */
export function logDebug(prefix: string, message: string): void {
    log(InternalLogLevel.Debug, prefix, message);
}

/**
 * Creates a new log message with log level `Warn`.
 *
 * The prefix will be wrapped in square brackets in the resulting log message.
 *
 * @param prefix The prefix used for the message.
 * @param message The actual content of the log message.
 */
export function logWarn(prefix: string, message: string): void {
    log(InternalLogLevel.Warn, prefix, message);
}

/**
 * Creates a new log message with log level `Error`.
 *
 * The prefix will be wrapped in square brackets in the resulting log message.
 *
 * @param prefix The prefix used for the message.
 * @param message The actual content of the log message.
 */
export function logError(prefix: string, message: string): void {
    log(InternalLogLevel.Error, prefix, message);
}

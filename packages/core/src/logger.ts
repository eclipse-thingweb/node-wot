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

let globalLogLevel: LogLevel | null = null;

const logLevelsByPrefix = new Map<string, LogLevel | null>();

function updateLogLevel(logLevel: LogLevel, prefix?: string): void {
    if (prefix == null) {
        globalLogLevel = logLevel;
    } else {
        logLevelsByPrefix.set(prefix, logLevel);
    }
}

/**
 * Sets a new log level either globally or, when defined, for a specific prefix.
 *
 * @param logLevel The new log level value.
 * @param prefix The optional prefix for which the log level should be set.
 */
export function setLogLevel(logLevel: LogLevel, prefix?: string): void {
    updateLogLevel(logLevel, prefix);
}

/**
 * Disables logging either globally or, when defined,
 * for a specific prefix.
 *
 * @param prefix The optional prefix for which the log level should be reset.
 */
export function disableLogging(prefix?: string): void {
    if (prefix == null) {
        globalLogLevel = null;
    } else if (logLevelsByPrefix.has(prefix)) {
        logLevelsByPrefix.set(prefix, null);
    }
}

/**
 * Resets the log level for a given prefix to the global log level.
 *
 * @param prefix The prefix for which the log level should be reset.
 */
export function resetLoglevelForPrefix(prefix: string): void {
    logLevelsByPrefix.delete(prefix);
}

/**
 * Type signature of a logger function.
 */
export type LoggerFunction = (message: string) => void;

let infoLogger: LoggerFunction = (message: string) => console.info(message);

let debugLogger: LoggerFunction = (message: string) => console.debug(message);

let warnLogger: LoggerFunction = (message: string) => console.warn(message);

let errorLogger: LoggerFunction = (message: string) => console.error(message);

/**
 * Type signature of functions that can be used for formatting log messages.
 */
export type LogMessageFormatter = (logLevel: LogLevel, prefix: string, message: string) => string;

let messageFormatter: LogMessageFormatter = (loglevel: LogLevel, prefix: string, message: string) =>
    `[${prefix}] ${message}`;

export function setLogger(logLevel: LogLevel, loggerFunction: LoggerFunction): void {
    switch (logLevel) {
        case LogLevel.Info:
            infoLogger = loggerFunction;
            break;
        case LogLevel.Debug:
            debugLogger = loggerFunction;
            break;
        case LogLevel.Warn:
            warnLogger = loggerFunction;
            break;
        case LogLevel.Error:
            errorLogger = loggerFunction;
            break;
    }
}

/**
 * Overrides the default formatting function with a custom one.
 *
 * This allows users to define custom format (e.g., different colors) based
 * on the log level.
 *
 * @param messageFormatterFunction The new message formatting function.
 */
export function setMessageFormatter(messageFormatterFunction: LogMessageFormatter): void {
    messageFormatter = messageFormatterFunction;
}

function log(logLevel: LogLevel, prefix: string, message: string): void {
    const logLevelToCheck = logLevelsByPrefix.get(prefix) ?? globalLogLevel;

    if (logLevelToCheck > logLevel || logLevelToCheck == null) {
        return;
    }

    const logMessage = messageFormatter(logLevelToCheck, prefix, message);

    switch (logLevel) {
        case LogLevel.Info:
            infoLogger(logMessage);
            break;
        case LogLevel.Debug:
            debugLogger(logMessage);
            break;
        case LogLevel.Warn:
            warnLogger(logMessage);
            break;
        case LogLevel.Error:
            errorLogger(logMessage);
            break;
    }
}

/**
 * Creates a new log message with log level `Info`.
 *
 * @param prefix The prefix used for the message.
 * @param message The actual content of the log message.
 */
export function logInfo(prefix: string, message: string): void {
    log(LogLevel.Info, prefix, message);
}

/**
 * Creates a new log message with log level `Debug`.
 *
 * @param prefix The prefix used for the message.
 * @param message The actual content of the log message.
 */
export function logDebug(prefix: string, message: string): void {
    log(LogLevel.Debug, prefix, message);
}

/**
 * Creates a new log message with log level `Warn`.
 *
 * @param prefix The prefix used for the message.
 * @param message The actual content of the log message.
 */
export function logWarn(prefix: string, message: string): void {
    log(LogLevel.Warn, prefix, message);
}

/**
 * Creates a new log message with log level `Error`.
 *
 * @param prefix The prefix used for the message.
 * @param message The actual content of the log message.
 */
export function logError(prefix: string, message: string): void {
    log(LogLevel.Error, prefix, message);
}

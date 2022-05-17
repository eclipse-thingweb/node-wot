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

import debug from "debug";

/**
 * The defined log levels.
 */
enum LogLevel {
    info,
    debug,
    warn,
    error,
}

/**
 * Interface containing a {@link debug.Debugger} object for every {@link LogLevel}.
 */
interface Loggers {
    info: debug.Debugger;
    debug: debug.Debugger;
    warn: debug.Debugger;
    error: debug.Debugger;
}

/**
 * Creates a new logging object for the given namespaces at the specified {@link LogLevel}.
 *
 * @param namespaces The namespaces which are used for the logger.
 * @param logLevel The {@link LogLevel} this logger function is corresponding with.
 * @returns A {@link debug.Debugger} object for logging at the corresponding {@link LogLevel}.
 */
function createLogger(namespaces: string[], logLevel: LogLevel): debug.Debugger {
    const namespace = ["node-wot", ...namespaces, LogLevel[logLevel]].join(":");
    return debug(namespace);
}

/**
 * Creates a new logger for the given namespaces at the log level `info`.
 *
 * @param namespaces The namespaces which are used for the logger.
 * @returns A {@link debug.Debugger} object for logging at the log level `info`.
 */
export function createInfoLogger(...namespaces: string[]): debug.Debugger {
    return createLogger(namespaces, LogLevel.info);
}

/**
 * Creates a new logger for the given namespaces at the log level `debug`.
 *
 * @param namespaces The namespaces which are used for the logger.
 * @returns A {@link debug.Debugger} object for logging at the log level `debug`.
 */
export function createDebugLogger(...namespaces: string[]): debug.Debugger {
    return createLogger(namespaces, LogLevel.debug);
}

/**
 * Creates a new logger for the given namespaces at the log level `warn`.
 *
 * @param namespaces The namespaces which are used for the logger.
 * @returns A {@link debug.Debugger} object for logging at the log level `warn`.
 */
export function createWarnLogger(...namespaces: string[]): debug.Debugger {
    return createLogger(namespaces, LogLevel.warn);
}

/**
 * Creates a new logger for the given namespaces at the log level `error`.
 *
 * @param namespaces The namespaces which are used for the logger.
 * @returns A {@link debug.Debugger} object for logging at the log level `error`.
 */
export function createErrorLogger(...namespaces: string[]): debug.Debugger {
    return createLogger(namespaces, LogLevel.error);
}

/**
 * Creates a loggers for the given namespaces at all defined log levels (`info`,
 * `debug`, `warn`, and `error`).
 *
 * @param namespaces The namespaces which are used for the logger.
 * @returns A {@link Loggers} object containing all created loggers.
 */
export function createLoggers(...namespaces: string[]): Loggers {
    return {
        info: createInfoLogger(...namespaces),
        debug: createDebugLogger(...namespaces),
        warn: createWarnLogger(...namespaces),
        error: createErrorLogger(...namespaces),
    };
}

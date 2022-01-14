/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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
import { should } from "chai";
import * as chai from "chai";
import { MBusForm } from "../src/mbus";
import chaiAsPromised from "chai-as-promised";
import { MBusConnection, PropertyOperation } from "../src/mbus-connection";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);

describe("mbus connection test", () => {
    before(() => {
        /* nothing */
    });

    after(() => {
        /* nothing */
    });

    it("should throw for timeout", () => {
        const connection = new MBusConnection("127.0.0.1", 806, {
            connectionTimeout: 200,
            connectionRetryTime: 10,
            maxRetries: 1,
        });
        return connection.connect().should.eventually.be.rejectedWith("Max connection retries");
    }).timeout(10000);

    describe("Operation", () => {
        it("should throw with timeout", async () => {
            const form: MBusForm = {
                href: "mbus+tcp://127.0.0.1:806",
                "mbus:offset": 0,
                "mbus:unitID": 1,
            };
            const connection = new MBusConnection("127.0.0.1", 806, {
                connectionTimeout: 1000,
                connectionRetryTime: 10,
                maxRetries: 1,
            });
            const op = new PropertyOperation(form);
            connection.enqueue(op);

            await connection.execute(op).should.eventually.be.rejected;

            connection.close();
        }).timeout(10000);
    });
});

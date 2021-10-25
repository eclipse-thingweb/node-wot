import { should } from "chai";
import * as chai from "chai";
import { MBusForm } from "../src/mbus";
import * as chaiAsPromised from "chai-as-promised";
import { MBusConnection, PropertyOperation } from "../src/mbus-connection";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);

describe("MBus connection", () => {
    before(() => {
        /* nothing */
    });

    after(() => {
        /* nothing */
    });

    it("should throw for unknown host", () => {
        const connection = new MBusConnection("127.0.0.2", 805, {
            connectionTimeout: 200,
            connectionRetryTime: 10,
            maxRetries: 1,
        });
        return connection.connect().should.eventually.be.rejectedWith("Max connection retries");
    }).timeout(10000);

    it("should throw for timeout", () => {
        const connection = new MBusConnection("127.0.0.1", 806, {
            connectionTimeout: 200,
            connectionRetryTime: 10,
            maxRetries: 1,
        });
        return connection.connect().should.eventually.be.rejectedWith("Max connection retries");
    }).timeout(10000);

    describe("Operation", () => {
        it("should fail for unknown host", async () => {
            const form: MBusForm = {
                href: "mbus+tcp://127.0.0.2:805",
                "mbus:offset": 0,
                "mbus:unitID": 1,
            };
            const connection = new MBusConnection("127.0.0.2", 805, {
                connectionTimeout: 200,
                connectionRetryTime: 10,
                maxRetries: 1,
            });
            const op = new PropertyOperation(form);
            connection.enqueue(op);

            await connection.execute(op).should.eventually.be.rejected;
            connection.close();
        }).timeout(10000);

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

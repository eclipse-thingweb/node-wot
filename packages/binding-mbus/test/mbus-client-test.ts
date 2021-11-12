import { should } from "chai";
import * as chai from "chai";
import MBusClient from "../src/mbus-client";
import { MBusForm } from "../src/mbus";
import chaiAsPromised from "chai-as-promised";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);

describe("mbus client test", () => {
    let client: MBusClient;

    before(() => {
        // Turn off logging to have a clean test log
        console.debug = () => {
            /* nothing */
        };
        console.warn = () => {
            /* nothing */
        };
    });

    beforeEach(() => {
        client = new MBusClient();
    });
    afterEach(() => {
        client.stop();
    });
    after(() => {
        /* nothing */
    });

    it("should override form values with URL", () => {
        const form: MBusForm = {
            href: "mbus+tcp://127.0.0.1:805/2?offset=2&timeout=5",
            "mbus:offset": 0,
            "mbus:timeout": 1,
            "mbus:unitID": 1,
        };

        // eslint-disable-next-line dot-notation
        client["overrideFormFromURLPath"](form);
        form["mbus:unitID"].should.be.equal(2, "Form value not overridden");
        form["mbus:offset"].should.be.equal(2, "Form value not overridden");
        form["mbus:timeout"].should.be.equal(5, "Form value not overridden");
    });

    describe("read resource", () => {
        it("should throw exception for missing offset", () => {
            const form: MBusForm = {
                href: "mbus+tcp://127.0.0.1:805",
                "mbus:unitID": 1,
            };

            const promise = client.readResource(form);

            return promise.should.eventually.rejectedWith("Malformed form: offset must be defined");
        });
    });
});

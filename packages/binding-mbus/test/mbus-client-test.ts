import { should } from "chai";
import * as chai from 'chai';
import MBusClient from "../src/mbus-client";
import { MBusForm } from "../src/mbus";
import * as chaiAsPromised from "chai-as-promised";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);

describe('mbus client test', () => {
    let client: MBusClient;

    before(() => {
        //Turn off logging to have a clean test log
        console.debug = ()=>{}
        console.warn = ()=>{}
    });

    beforeEach(() => {
        client = new MBusClient();
    });
    afterEach(() => {
        client.stop()
    });
    after(() => {
		
    });
	
    it('should override form values with URL', () => {
        const form: MBusForm = {
            href: "mbus+tcp://127.0.0.1:805/2?offset=2&timeout=5",
            "mbus:offset": 0,
            "mbus:timeout": 1,
            "mbus:unitID": 1
        }

        client["overrideFormFromURLPath"](form)
        form["mbus:unitID"].should.be.equal(2, "Form value not overridden")
        form["mbus:offset"].should.be.equal(2, "Form value not overridden")
        form["mbus:timeout"].should.be.equal(5, "Form value not overridden")
    });

    describe('misc', () => {
        it('should fail for timeout', async () => {
            const form: mbusForm = {
                href: "mbus+tcp://127.0.0.1:805",
				"mbus:offset": 0,
				"mbus:unitID": 1,
                "mbus:timeout": 1000
            }

            await client.readResource(form).should.eventually.be.rejected;
        }).timeout(5000);
    });
    describe('read resource', () => {
        it('should throw exception for missing offset', () => {

            const form: mbusForm = {
                href: "mbus+tcp://127.0.0.1:805",
                "mbus:unitID": 1
            }

            const promise = client.readResource(form)

            return promise.should.eventually.rejectedWith("Malformed form: offset must be defined")
        });
		
		it('should throw exception for missing unitID', () => {

            const form: mbusForm = {
                href: "mbus+tcp://127.0.0.1:805",
                "mbus:offset": 0
            }

            const promise = client.readResource(form)

            return promise.should.eventually.rejectedWith("Malformed form: unitID must be defined")
        });
    });
});

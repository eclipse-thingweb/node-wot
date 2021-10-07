import { VariableIds, OPCUAServer, DataValue } from "node-opcua";
import { ContentSerdes, ProtocolHelpers } from "@node-wot/core";

import { OPCUAProtocolClient, OPCUAForm } from "../src/opcua_protocol_client";
import { OpcuaJSONCodec, schemaDataValue } from "../src/codec";

import { startServer } from "./fixture/basic_opcua_server";

describe("OPCUA Client", function () {
    this.timeout(10000);

    let opcuaServer: OPCUAServer;
    let endpoint: string;
    before(async () => {
        opcuaServer = await startServer();
        endpoint = opcuaServer.getEndpointUrl();
        console.log("endpoint = ", endpoint);
    });
    before(() => {
        // ensure codec is loaded
        const codecSerDes = ContentSerdes.get();
        codecSerDes.addCodec(new OpcuaJSONCodec());
    });
    after(async () => {
        await opcuaServer.shutdown();
    });

    let client: OPCUAProtocolClient;
    before(async function () {
        client = new OPCUAProtocolClient();
    });
    after(async () => {
        await client.stop();
    });

    ["application/opcua-json", "application/opcua-json;type=DataValue", "application/opcua-json;type=Variant"].forEach(
        (contentType) => {
            it("Y1- should read a topic with contentType= " + contentType, async () => {
                const readForm: OPCUAForm = {
                    href: endpoint,
                    "opcua:nodeId": VariableIds.Server_ServerStatus_CurrentTime,
                    contentType,
                };

                const content = await client.readResource(readForm);
                const content2 = { ...content, body: await ProtocolHelpers.readStreamFully(content.body) };

                console.log(content2.body);

                const codecSerDes = ContentSerdes.get();
                const dataValue = codecSerDes.contentToValue(content2, schemaDataValue) as DataValue;
                console.log(dataValue.toString());
            });
        }
    );

    it("Y2 - should subscribe to a topic", async () => {
        const form: OPCUAForm = {
            href: endpoint,
            "opcua:nodeId": VariableIds.Server_ServerStatus_CurrentTime,
        };

        let counter = 0;
        const sub = await client.subscribeResource(form, async () => {
            counter++;
            if (counter > 3) {
                // await client.unlinkResource(form);
                sub.unsubscribe();
            }
        });
    });
    it("Y3 - should subscribe to many topics but establish the opcua connection once", async () => {
        const form: OPCUAForm = {
            href: endpoint,
            "opcua:nodeId": VariableIds.Server_ServerStatus_CurrentTime,
        };

        await new Promise<void>((resolve) => {
            let counter = 0;
            const onSubscribedValueChanged = async () => {
                counter++;
                if (counter > 3) {
                    await client.unlinkResource(form);
                    resolve();
                }
            };
            client.subscribeResource(form, onSubscribedValueChanged);
            client.subscribeResource(form, onSubscribedValueChanged);
            client.subscribeResource(form, onSubscribedValueChanged);
            client.subscribeResource(form, onSubscribedValueChanged);
        });
    });
});

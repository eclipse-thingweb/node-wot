import { ProtocolClientFactory, ProtocolClient, ContentSerdes } from "@node-wot/core";
import { OpcuaJSONCodec, OpcuaBinaryCodec } from "./codec";
import { OPCUAProtocolClient } from "./opcua_protocol_client";

export class OPCUAClientFactory implements ProtocolClientFactory {
    readonly scheme: string = "opc.tcp";

    private _clients: OPCUAProtocolClient[] = [];

    public contentSerdes: ContentSerdes = ContentSerdes.get();

    constructor() {
        this.contentSerdes.addCodec(new OpcuaJSONCodec());
        this.contentSerdes.addCodec(new OpcuaBinaryCodec());
    }

    getClient(): ProtocolClient {
        console.debug("[binding-opcua]", `OpcuaClientFactory creating client for '${this.scheme}'`);
        if (this._clients[0]) {
            return this._clients[0];
        }
        this._clients[0] = new OPCUAProtocolClient();
        return this._clients[0];
    }

    init(): boolean {
        console.debug("[binding-opcua]", "init");
        return true;
    }

    destroy(): boolean {
        console.debug("[binding-opcua]", "destroy");

        const clients = this._clients;
        this._clients = [];
        (async () => {
            for (const client of clients) {
                await client.stop();
            }
        })();
        return true;
    }
}

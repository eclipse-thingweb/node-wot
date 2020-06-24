import * as nodeNetconf from 'node-netconf';
import * as xpath2json from './xpath2json';
import { promises as fsPromises } from 'fs';


let METHOD_OBJ: any = {};
METHOD_OBJ["GET-CONFIG"] = { 'get-config': { $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" }, source: { candidate: {}, }, filter: { $: { type: "subtree" } } } };
METHOD_OBJ["EDIT-CONFIG"] = { 'edit-config': { $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" }, target: { candidate: {}, }, config: {} } };
METHOD_OBJ["COMMIT"] = { 'commit': { $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" } } };
METHOD_OBJ["RPC"] = {};

export class Client {
	private router: any;

	constructor() {
		this.router = null;
	}

	getRouter() {
		return this.router;
	}

	deleteRouter() {
		this.router = null;
	}

	async initializeRouter(host: string, port: number, credentials: any) {
		if (this.router && this.router.connected) { //close the old one
			this.closeRouter();
		}
		this.router = {};
		this.router.host = host;
		this.router.port = port;
		this.router.username = credentials.username;
		if (credentials.privateKey) {
			this.router.pkey = await fsPromises.readFile(credentials.privateKey, { encoding: 'utf8' });
		}
		if (credentials.password) {
			this.router.password = credentials.password;
		}
		return new Promise((resolve, reject) => {
			resolve();
		});
	}

	openRouter() {
		let self = this;
		return new Promise((resolve, reject) => {
			if (self.router.connected) { //close the old one
				this.closeRouter();
			}
			self.router = new nodeNetconf.Client(this.router);
			self.router.open(function afterOpen(err: string) {
				if (err) {
					reject(err);	
				} else {
					console.debug("[binding-netconf]",`New NetConf router opened connection with host ${self.router.host}, port ${self.router.port}, username ${self.router.username}`);
					resolve();
				}
			});
		});
	}


	rpc(xpath_query: string, method: string, NSs: any, target: string, payload?: any) {
		let self = this;
		return new Promise((resolve, reject) => {
			if (payload) {
				xpath_query = xpath2json.addLeaves(xpath_query, payload);
			}
			let obj_request = xpath2json.xpath2json(xpath_query, NSs);
			let final_request: any = {};
			final_request = JSON.parse(JSON.stringify(METHOD_OBJ[method])); //clone the METHOD_OBJ
			switch (method) {
				default:
				case "GET-CONFIG": {
					final_request["get-config"].filter = Object.assign(final_request["get-config"].filter, obj_request);
					final_request["get-config"].source = {};
					final_request["get-config"].source[target] = {};
					break;
				}
				case "EDIT-CONFIG": {
					final_request["edit-config"].config = Object.assign(final_request["edit-config"].config, obj_request);
					final_request["edit-config"].target = {};
					final_request["edit-config"].target[target] = {};
					break;
				}
				case "COMMIT": {
					break;
				}
				case "RPC": {
					final_request = obj_request; //just take the rpc as was created starting from xpath
					break;
				}
			}
			self.router.rpc(final_request, function (err: string, results: any) {
				if (err) {
					reject(err);
				}
				resolve(results);
			});
		});
	}

	closeRouter() {
		this.router.sshConn.end();
		this.router.connected = false;
	}
}
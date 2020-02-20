import { OPCUAServer, Variant, DataType, StatusCodes } from "node-opcua";

export class OpcuaServer {

	server: OPCUAServer;

	constructor() {
		this.server = new OPCUAServer({
			port: 5050, // the port of the listening socket of the server
			resourcePath: "/opcua/server", // this path will be added to the endpoint resource name
			allowAnonymous: true
		});
	}

	async start() {
		// Let's create an instance of OPCUAServer
		try {
			await this.server.initialize();
			this.construct_my_address_space(this.server);
			await this.server.start();
			const endpointUrl = this.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
			console.log('OPCUA server started');
		} catch (err) {
			throw new Error(err);
		}
	}

	async stop() {
		this.server.shutdown(1000, function () {
			process.exit(-1);  //  add this line to stop the process
		});
	}

	construct_my_address_space(server: any) {

		const addressSpace = server.engine.addressSpace;
		const namespace = addressSpace.getOwnNamespace();


		// OBJECTS
		const device = namespace.addObject({
			organizedBy: addressSpace.rootFolder.objects,
			nodeId: "ns=1;b=9990FFAA", // some opaque NodeId in namespace 4
			browseName: "WotDevice",
			targetName: {
				namespaceIndex: 1,
				name: "device"
			},
		});

		// VARIABLES

		let variable = 1;
		setInterval(function () { variable += 1; }, 1000);

		namespace.addVariable({
			componentOf: device,
			nodeId: "ns=1;b=9998FFAA", // some opaque NodeId in namespace 4
			browseName: "Increment",
			dataType: "Double",
			value: {
				get: function () {
					return new Variant({ dataType: DataType.Double, value: variable });
				}
			}
		});


		namespace.addVariable({
			nodeId: "ns=1;b=9999FFAA",
			browseName: "RandomValue",
			dataType: "Double",
			value: {
				get: function () {
					return new Variant({ dataType: DataType.Double, value: Math.random() });
				},
				set: function (variant: any) { //write property
					variable = parseFloat(variant.value);
					return StatusCodes.Good;
				}
			}
		});

		const method = namespace.addMethod(device, { //invoke action

			browseName: "DivideFunction",
			nodeId: "ns=1;b=9997FFAA",
			inputArguments: [
				{
					name: "a",
					description: { text: "specifies the first number" },
					dataType: DataType.Double
				}, {
					name: "b",
					description: { text: "specifies the second number" },
					dataType: DataType.Double
				}
			],

			outputArguments: [{
				name: "division",
				description: { text: "the generated barks" },
				dataType: DataType.Double,
				valueRank: 1
			}]
		});

		method.bindMethod((inputArguments: any, context: any, callback: any) => {

			const a = inputArguments[0].value;
			const b = inputArguments[1].value;

			let res = a / b;
			const callMethodResult = {
				statusCode: StatusCodes.Good,
				outputArguments: [{
					dataType: DataType.Double,
					value: res
				}]
			};
			callback(null, callMethodResult);
		});

	}
}
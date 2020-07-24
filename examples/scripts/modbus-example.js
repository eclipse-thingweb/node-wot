

WoTHelpers.fetch("file://./modbus-thing.jsonld").then( async (td) => {

	let cf = await WoT.consume(td);
	try {

		let res = await cf.writeProperty("coilProp", true);
		res = await cf.readProperty("coilProp");
		console.log("Coil set to",res)
		res = await cf.writeProperty("registerProp", 300);
		res = await cf.readProperty("registerProp");
		console.log("Register set to",res)

	} catch(err) {
		console.error("Application error:", err.message);
		console.error(err);
		
	}


}).catch( (err) => { console.error("Fetch error:", err.message); });

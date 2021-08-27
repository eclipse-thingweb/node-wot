

WoTHelpers.fetch("file://./mbus-thing.json").then( async (td) => {

	let mbusThing = await WoT.consume(td);
	try {

		let res = await mbusThing.readProperty("SlaveInformation");
		console.log("Slave Informations:",res);
		res = await mbusThing.readProperty("Volume0");
		console.log("Volume 0:",res.Value)
		res = await mbusThing.readProperty("TimeAndDate");
		console.log("Time and Date:",res.Value)

	} catch(err) {
		console.error("Application error:", err.message);
		console.error(err);
		
	}


}).catch( (err) => { console.error("Fetch error:", err.message); });

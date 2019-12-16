var util = require('util');


function pprint(object) {
	console.log(util.inspect(object, {depth:null, colors:true}));
}

WoTHelpers.fetch("file://./netconf-thing.jsonld").then( async (td) => {

	let cf = await WoT.consume(td);
	try {

		res = await cf.writeProperty("interface-candidate", {type: {xmlns: "urn:ietf:params:xml:ns:yang:iana-if-type", value: "modem"}});
		res = await cf.readProperty("interface-candidate");
		pprint(res);

		res = await cf.writeProperty("ipv6-candidate", { enabled: true });
		res = await cf.readProperty("ipv6-candidate");
		pprint(res);

		//res = await cf.writeProperty("ipv6-address-running", { ip: "2001:db8:0:0:0:ff00:42:8329", "prefix-length": 96});

		res = await cf.invokeAction("commit"); //check that running is writable!


	} catch(err) {
		console.error("Application error:", err.message);
	}


}).catch( (err) => { console.error("Fetch error:", err.message); });

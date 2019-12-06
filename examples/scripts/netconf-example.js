var util = require('util');


function pprint(object) {
	console.log(util.inspect(object, {depth:null, colors:true}));
}

WoTHelpers.fetch("file://./netconf-thing.jsonld").then( async (td) => {

	let cf = await WoT.consume(td);
	try {
		res = await cf.writeProperty("ipv6-candidate", { enabled: true });
		res = await cf.readProperty("ipv6-candidate");
		pprint(res);

		res = await cf.writeProperty("ipv6-address-running", { ip: "2001:db8:0:0:0:ff00:42:8329", "prefix-length": 96});

		res = await cf.writeProperty("ipv6-candidate", { address: { ip: "1001:db8:0:0:0:ff00:42:8323", "prefix-length": 64}});

		res = await cf.readProperty("ipv6-address-candidate");
		pprint(res);
		return;


		res = await cf.writeProperty("interface-candidate", { name: "Interface100", type: "iana-if-type\\:modem"});

		res = await cf.readProperty("interface-candidate");
		pprint(res);

		res = await cf.invokeAction("commit");


	} catch(err) {
		console.error("Application error:", err.message);
	}


}).catch( (err) => { console.error("Fetch error:", err.message); });

var util = require('util');
const homedir = require('os').homedir();


function pprint(object) {
    console.log(util.inspect(object, {depth:null, colors:true}));
}

WoTHelpers.fetch("file://./opcua-thing.jsonld").then( async (td) => {

    let cf = await WoT.consume(td);
    try {

        res = await cf.invokeAction("Division", {a: 10, c:2});
        pprint(res);

        res = await cf.invokeAction("Square", 12);
        pprint(res);

        await cf.writeProperty("Var", 920);
        res = await cf.readProperty("Var");
        pprint(res);

        res = await cf.readProperty("RandomValue");
        pprint(res);

        cf.observeProperty("Var",
            x => {
                console.info("onNext:", x);
            },
            e => console.log("onError: %s", e),
            () => {
                console.log("onCompleted");
            }
        );
    } catch(err) {
        console.error("Mashup error:", err.message);
    }


}).catch( (err) => { console.error("Fetch error:", err.message); });

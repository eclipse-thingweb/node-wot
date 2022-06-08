const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

const main = async () => {
    const td_url = "http://plugfest.thingweb.io:8083/counter";
    try {
        const td = await WoTHelpers.fetch(td_url);
        const thing = await WoT.consume(td);
        console.log("BEFORE readProperty");
        const reader = await thing.readProperty("count");
        console.log("AFTER readProperty");
        await delay(5000);
        console.log("Here we have the console.log");
        console.log("BEFORE value");
        const ris = await reader.value(); //here we have the bug
        console.log("AFTER value");
        console.log(
            "Here we haven't the console.log and for some reason, the script exit with no error (skipping the catch too)."
        );
        console.log("WotTest result: ", ris);
    } catch (err) {
        console.log("Error: ");
        console.log("WotTest: ResolveTD error 1:", err);
    }
};

main();

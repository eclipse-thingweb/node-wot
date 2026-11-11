/* eslint no-console: "off" */

const fs = require("node:fs");
const path = require("node:path");
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

const tdFile = path.join(__dirname, "storm-data-influxdb.td.json");
const influxUrl = process.env.INFLUXDB_URL;

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());

servient
    .start()
    .then(async (WoT) => {
        try {
            const thingDescription = JSON.parse(fs.readFileSync(tdFile, "utf8"));
            if (influxUrl != null) {
                thingDescription.base = influxUrl.endsWith("/") ? influxUrl : `${influxUrl}/`;
            }
            const thing = await WoT.consume(thingDescription);

            const eventCount = await (await thing.readProperty("eventCount")).value();
            const maxMagnitude = await (await thing.readProperty("maxMagnitude")).value();
            const tornadoes = await (await thing.readProperty("tornadoes")).value();
            const magnitudeSeries = await (await thing.readProperty("magnitudeSeries")).value();

            console.log(`eventCount: ${eventCount}`);
            console.log(`maxMagnitude: ${maxMagnitude}`);
            console.log(`tornadoes: ${tornadoes.length} events, first: ${JSON.stringify(tornadoes[0])}`);
            console.log(
                `magnitudeSeries: ${magnitudeSeries.length} points, first: ${JSON.stringify(magnitudeSeries[0])}`
            );
        } catch (err) {
            console.error("InfluxDB storm data client error:", err);
            process.exitCode = 1;
        } finally {
            await servient.shutdown();
        }
    })
    .catch((err) => {
        console.error("InfluxDB storm data client start error:", err);
        process.exitCode = 1;
    });

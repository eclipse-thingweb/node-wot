/* eslint no-console: "off" */

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Servient } = require("@node-wot/core");
const { FileClientFactory } = require("@node-wot/binding-file");

const tdFile = pathToFileURL(path.join(__dirname, "toa5-weather.td.json")).href;
const dataDirectory = pathToFileURL(path.join(__dirname, path.sep)).href;

const servient = new Servient();
servient.addClientFactory(new FileClientFactory());

servient
    .start()
    .then(async (WoT) => {
        try {
            const thingDescription = await WoT.requestThingDescription(tdFile);
            // Set the base URL for the data directory instead of writing "file://" with full path to the href directly
            thingDescription.base = dataDirectory;
            const thing = await WoT.consume(thingDescription);

            for (const propertyName of ["timestamp", "airTemperature", "relativeHumidity", "windSpeed", "windSpeedSeries"]) {
                const output = await thing.readProperty(propertyName);
                const value = await output.value();
                console.log(`${propertyName}: ${JSON.stringify(value)}`);
            }
        } catch (err) {
            console.error("CSV client error:", err);
            process.exitCode = 1;
        } finally {
            await servient.shutdown();
        }
    })
    .catch((err) => {
        console.error("CSV client start error:", err);
        process.exitCode = 1;
    });

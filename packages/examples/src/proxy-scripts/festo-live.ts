import { Helpers } from "@node-wot/core";

let WoTHelpers: Helpers;

console.debug = () =>  {};
console.log = () => {};

let PumpP101: WoT.ConsumedThing, ValveV102: WoT.ConsumedThing;

let thingExposed: WoT.ExposedThing;

// fetch and consume NodeMCU Things
let fetchArray = [
  WoTHelpers.fetch("file://./tdPumpP101.jsonld"),
  WoTHelpers.fetch("file://./tdValveV102.jsonld"),
  WoTHelpers.fetch("file://./tdUltrasonicSensorB101.jsonld"),
  WoTHelpers.fetch("file://./tdB114.jsonld"),
  WoTHelpers.fetch("file://./tdB113.jsonld"),
  WoTHelpers.fetch("file://./tdS111.jsonld"),
  WoTHelpers.fetch("file://./tdS112.jsonld") ];

Promise.all(fetchArray).then(async (tdArray) => {
  // order must match order of jsonld files
  let [tdPumpP101, tdValveV102, tdUltrasonicSensorB101, tdB114, tdB113, tdS111, tdS112] = tdArray;

  PumpP101 = await WoT.consume(tdPumpP101); // Status
  ValveV102 = await WoT.consume(tdValveV102); // Status

  let UltrasonicSensorB101 = await WoT.consume(tdUltrasonicSensorB101); // level
  let LevelSensorB114 = await WoT.consume(tdB114); // maxlevel101
  let LevelSensorB113 = await WoT.consume(tdB113); // minlevel101

  let LevelSwitchS111 = await WoT.consume(tdS111); // overflow101
  let FloatSwitchS112 = await WoT.consume(tdS112); // overflow102

  // regularly sync state to exposed Thing
  setInterval( () => {

    // TODO FIX after v0.8 API changes are in place
    console.error("TODO FIX after v0.8 API changes are in place");

    /*
    PumpP101.readProperty("status")
      .then(async value => {
        let valuep = await Helpers.parseInteractionOutput(value);
        console.info("+++ PumpStatus " + valuep);
        thingExposed.writeProperty("PumpStatus", valuep === "ON" ? true : false);
      })
      .catch(err => { console.error("--- PumpStatus read error: " + err); });

    ValveV102.readProperty("status")
      .then(async value => {
        let valuep = await Helpers.parseInteractionOutput(value);
        console.info("+++ ValveStatus " + valuep);
        thingExposed.writeProperty("ValveStatus", valuep === "OPEN" ? true : false);
      })
      .catch(err => { console.error("--- ValveStatus read error: " + err); });

    UltrasonicSensorB101.readProperty("levelvalue")
      .then(value => {
        console.info("+++ Tank102LevelValue " + value);
        thingExposed.writeProperty("Tank102LevelValue", value);
      })
      .catch(err => { console.error("--- Tank102LevelValue read error: " + err); });

    FloatSwitchS112.readProperty("overflow102")
      .then(value => {
        console.info("+++ Tank102OverflowStatus " + value);
        thingExposed.writeProperty("Tank102OverflowStatus", value);
      })
      .catch(err => { console.error("--- Tank102OverflowStatus read error: " + err); });

    LevelSensorB114.readProperty("maxlevel101")
      .then(value => {
        console.info("+++ Tank101MaximumLevelStatus " + value);
        thingExposed.writeProperty("Tank101MaximumLevelStatus", value);
      })
      .catch(err => { console.error("--- Tank101MaximumLevelStatus read error: " + err); });

    LevelSensorB113.readProperty("minlevel101")
      .then(value => {
        console.info("+++ Tank101MinimumLevelStatus " + value);
        thingExposed.writeProperty("Tank101MinimumLevelStatus", value);
      })
      .catch(err => { console.error("--- Tank101MinimumLevelStatus read error: " + err); });

    LevelSwitchS111.readProperty("overflow101")
      .then(value => {
        console.info("+++ Tank101OverflowStatus " + value);
        thingExposed.writeProperty("Tank101OverflowStatus", value);
      })
      .catch(err => { console.error("--- Tank101OverflowStatus read error: " + err); });
    */

  }, 5000);
});



// exposed Thing toward Oracle IoT Cloud Service
WoT.produce({
  title: "FestoLive",
  id: "urn:dev:wot:siemens:festolive",
  "iotcs:deviceModel": "urn:com:siemens:wot:festo",
  properties: {
		PumpStatus: {
			type: "boolean",
			readOnly: true
    },
    ValveStatus: {
			type: "boolean",
			readOnly: true
		},
    Tank102LevelValue: {
			type: "number",
			readOnly: true
		},
    Tank102OverflowStatus: {
			type: "boolean",
			readOnly: true
		},
    Tank101MaximumLevelStatus: {
			type: "boolean",
			readOnly: true
		},
    Tank101MinimumLevelStatus: {
			type: "boolean",
			readOnly: true
		},
    Tank101OverflowStatus: {
			type: "boolean",
			readOnly: true
		}
	},
	actions: {
		StartPump: {
    },
    StopPump: {
		},
    OpenValve: {
		},
    CloseValve: {
		}
	}
})
.then((thing) => {
  console.log("Produced " + thing.getThingDescription().title);
  thingExposed = thing;

  // TODO FIX after v0.8 API changes are in place
  console.error("TODO FIX after v0.8 API changes are in place");

  /*
  // init property values
  // actuator state
	thing.writeProperty("PumpStatus", false); 
  thing.writeProperty("ValveStatus", false); 
  // upper tank (102)
  thing.writeProperty("Tank102LevelValue", 0.0); 
  thing.writeProperty("Tank102OverflowStatus", false);
  // lower tank (101)
  thing.writeProperty("Tank101MaximumLevelStatus", false);
  thing.writeProperty("Tank101MinimumLevelStatus", false);
  thing.writeProperty("Tank101OverflowStatus", false);

  // set action handlers
  thing.setActionHandler("StartPump", () => {
		return new Promise<any>((resolve, reject) => {
      console.info(">>> Startung pump!");
      PumpP101.invokeAction("on")
        .then(() => { resolve(); })
        .catch((err) => { console.error("--- StartPump invoke error: " + err); reject(err); });
			resolve();
		});
  });
  thing.setActionHandler("StopPump", () => {
		return new Promise<any>((resolve, reject) => {
      console.info(">>> Stopping pump!");
      PumpP101.invokeAction("off")
        .then(() => { resolve(); })
        .catch((err) => { console.error("--- StopPump invoke error: " + err); reject(err); });
			resolve();
		});
  });
  thing.setActionHandler("OpenValve", () => {
		return new Promise<any>((resolve, reject) => {
      console.info(">>> Opening valve!");
      ValveV102.invokeAction("open")
        .then(() => { resolve(); })
        .catch((err) => { console.error("--- OpenValve invoke error: " + err); reject(err); });
			resolve();
		});
  });
  thing.setActionHandler("CloseValve", () => {
		return new Promise<any>((resolve, reject) => {
      console.info(">>> Closing valve!");
      ValveV102.invokeAction("close")
        .then(() => { resolve(); })
        .catch((err) => { console.error("--- CloseValve invoke error: " + err); reject(err); });
			resolve();
		});
	});

  // expose the thing
	thing.expose().then( () => { console.info(thing.getThingDescription().title + " ready"); } );
  */
})
.catch((e) => {
	console.log(e)
});



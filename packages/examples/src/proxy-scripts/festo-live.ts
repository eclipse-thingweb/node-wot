import { Helpers } from "@node-wot/core";

let WoTHelpers: Helpers;

console.debug = () =>  {};
console.log = () => {};

let PumpP101: WoT.ConsumedThing, ValveV102: WoT.ConsumedThing;

let thingExposed: WoT.ExposedThing;

// init property values
// actuator state
let PumpStatus = false; 
let ValveStatus =false; 
// upper tank (102)
let Tank102LevelValue = 0.0; 
let Tank102OverflowStatus = false;
// lower tank (101)
let Tank101MaximumLevelStatus = false;
let Tank101MinimumLevelStatus = false;
let Tank101OverflowStatus = false;

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

    PumpP101.readProperty("status")
      .then(async value => {
        let valuep = await Helpers.parseInteractionOutput(value);
        console.info("+++ PumpStatus " + valuep);
        PumpStatus = valuep === "ON" ? true : false;
      })
      .catch(err => { console.error("--- PumpStatus read error: " + err); });

    ValveV102.readProperty("status")
      .then(async value => {
        let valuep = await Helpers.parseInteractionOutput(value);
        console.info("+++ ValveStatus " + valuep);
        ValveStatus = valuep === "OPEN" ? true : false;
      })
      .catch(err => { console.error("--- ValveStatus read error: " + err); });

    UltrasonicSensorB101.readProperty("levelvalue")
      .then(value => {
        console.info("+++ Tank102LevelValue " + value);
        Tank102LevelValue = <any>value; // TODO fix reading InteractionOutput
      })
      .catch(err => { console.error("--- Tank102LevelValue read error: " + err); });

    FloatSwitchS112.readProperty("overflow102")
      .then(value => {
        console.info("+++ Tank102OverflowStatus " + value);
        Tank102OverflowStatus = <any>value; // TODO fix reading InteractionOutput
      })
      .catch(err => { console.error("--- Tank102OverflowStatus read error: " + err); });

    LevelSensorB114.readProperty("maxlevel101")
      .then(value => {
        console.info("+++ Tank101MaximumLevelStatus " + value);
        Tank101MaximumLevelStatus = <any>value; // TODO fix reading InteractionOutput
      })
      .catch(err => { console.error("--- Tank101MaximumLevelStatus read error: " + err); });

    LevelSensorB113.readProperty("minlevel101")
      .then(value => {
        console.info("+++ Tank101MinimumLevelStatus " + value);
        Tank101MinimumLevelStatus = <any>value; // TODO fix reading InteractionOutput
      })
      .catch(err => { console.error("--- Tank101MinimumLevelStatus read error: " + err); });

    LevelSwitchS111.readProperty("overflow101")
      .then(value => {
        console.info("+++ Tank101OverflowStatus " + value);
        Tank101OverflowStatus = <any>value; // TODO fix reading InteractionOutput
      })
      .catch(err => { console.error("--- Tank101OverflowStatus read error: " + err); });

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

  // set property read handlers
  // actuator state
  thing.setPropertyReadHandler("PumpStatus", () => {
		return new Promise<any>((resolve, reject) => {
      resolve(PumpStatus);
		});
  });
  thing.setPropertyReadHandler("ValveStatus", () => {
		return new Promise<any>((resolve, reject) => {
      resolve(ValveStatus);
		});
  });
  // upper tank (102)
  thing.setPropertyReadHandler("Tank102LevelValue", () => {
		return new Promise<any>((resolve, reject) => {
      resolve(Tank102LevelValue);
		});
  });
  thing.setPropertyReadHandler("Tank102OverflowStatus", () => {
		return new Promise<any>((resolve, reject) => {
      resolve(Tank102OverflowStatus);
		});
  });
  // lower tank (101)
  thing.setPropertyReadHandler("Tank101MaximumLevelStatus", () => {
		return new Promise<any>((resolve, reject) => {
      resolve(Tank101MaximumLevelStatus);
		});
  });
  thing.setPropertyReadHandler("Tank101MinimumLevelStatus", () => {
		return new Promise<any>((resolve, reject) => {
      resolve(Tank101MinimumLevelStatus);
		});
  });
  thing.setPropertyReadHandler("Tank101OverflowStatus", () => {
		return new Promise<any>((resolve, reject) => {
      resolve(Tank101OverflowStatus);
		});
  });

  // set action handlers
  thing.setActionHandler("StartPump", () => {
		return new Promise<any>((resolve, reject) => {
      console.info(">>> Startung pump!");
      PumpP101.invokeAction("on")
        .then(() => { resolve(undefined); })
        .catch((err) => { console.error("--- StartPump invoke error: " + err); reject(err); });
			resolve(undefined);
		});
  });
  thing.setActionHandler("StopPump", () => {
		return new Promise<any>((resolve, reject) => {
      console.info(">>> Stopping pump!");
      PumpP101.invokeAction("off")
        .then(() => { resolve(undefined); })
        .catch((err) => { console.error("--- StopPump invoke error: " + err); reject(err); });
			resolve(undefined);
		});
  });
  thing.setActionHandler("OpenValve", () => {
		return new Promise<any>((resolve, reject) => {
      console.info(">>> Opening valve!");
      ValveV102.invokeAction("open")
        .then(() => { resolve(undefined); })
        .catch((err) => { console.error("--- OpenValve invoke error: " + err); reject(err); });
			resolve(undefined);
		});
  });
  thing.setActionHandler("CloseValve", () => {
		return new Promise<any>((resolve, reject) => {
      console.info(">>> Closing valve!");
      ValveV102.invokeAction("close")
        .then(() => { resolve(undefined); })
        .catch((err) => { console.error("--- CloseValve invoke error: " + err); reject(err); });
			resolve(undefined);
		});
	});

  // expose the thing
	thing.expose().then( () => { console.info(thing.getThingDescription().title + " ready"); } );
})
.catch((e) => {
	console.log(e)
});



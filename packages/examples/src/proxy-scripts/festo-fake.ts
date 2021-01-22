
// init property values
let PumpStatus = false;
let ValveStatus = false;
// upper tank (102)
let Tank102LevelValue = 0.0;
let Tank102OverflowStatus = false;
// lower tank (101)
let Tank101MaximumLevelStatus = false;
let Tank101MinimumLevelStatus = false;
let Tank101OverflowStatus = false;

WoT.produce({
  title: "FestoFake",
  id: "urn:dev:wot:siemens:festofake",
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

  // set property read handlers
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
			console.warn(">>> Startung pump!");
      resolve(undefined);
		});
  });
  thing.setActionHandler("StopPump", () => {
		return new Promise<any>((resolve, reject) => {
			console.warn(">>> Stopping pump!");
      resolve(undefined);
		});
  });
  thing.setActionHandler("OpenValve", () => {
		return new Promise<any>((resolve, reject) => {
			console.warn(">>> Opening valve!");
      resolve(undefined);
		});
  });
  thing.setActionHandler("CloseValve", () => {
		return new Promise<any>((resolve, reject) => {
			console.warn(">>> Closing valve!");
      resolve(undefined);
		});
	});
	
	thing.expose().then( () => {
    console.info(thing.getThingDescription().title + " ready");

    setInterval( () => {
      PumpStatus = Math.random()<0.5 ? true : false;
      ValveStatus = Math.random()<0.5 ? true : false;
      let level102 = Math.random() * 150;
      Tank102LevelValue = level102;
      Tank102OverflowStatus = level102 > 140;
      let level101 = 150 - level102;
      Tank101MaximumLevelStatus = level101 > 100;
      Tank101MinimumLevelStatus = level101 > 10;
      Tank101OverflowStatus = level101 > 140;
    }, 5000);
  });
})
.catch((e) => {
	console.log(e)
});

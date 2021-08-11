/********************************************************************************
 * Copyright (c) 2020 - 2021 Contributors to the Eclipse Foundation
 * 
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 * 
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 * 
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/
import "wot-typescript-definitions"

let WoT:WoT.WoT;

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
	
	// init property values
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
			console.warn(">>> Startung pump!");
      resolve();
		});
  });
  thing.setActionHandler("StopPump", () => {
		return new Promise<any>((resolve, reject) => {
			console.warn(">>> Stopping pump!");
      resolve();
		});
  });
  thing.setActionHandler("OpenValve", () => {
		return new Promise<any>((resolve, reject) => {
			console.warn(">>> Opening valve!");
      resolve();
		});
  });
  thing.setActionHandler("CloseValve", () => {
		return new Promise<any>((resolve, reject) => {
			console.warn(">>> Closing valve!");
      resolve();
		});
	});
	
	thing.expose().then( () => {
    console.info(thing.getThingDescription().title + " ready");

    setInterval( () => {
      thing.writeProperty("PumpStatus", Math.random()<0.5 ? true : false);
      thing.writeProperty("ValveStatus", Math.random()<0.5 ? true : false);
      let level102 = Math.random() * 150;
      thing.writeProperty("Tank102LevelValue", level102);
      thing.writeProperty("Tank102OverflowStatus", level102 > 140);
      let level101 = 150 - level102;
      thing.writeProperty("Tank101MaximumLevelStatus", level101 > 100);
      thing.writeProperty("Tank101MinimumLevelStatus", level101 > 10);
      thing.writeProperty("Tank101OverflowStatus", level101 > 140);
    }, 5000);
  });
})
.catch((e) => {
	console.log(e)
});

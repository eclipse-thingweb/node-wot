var PumpP101, ValveV102;

// fetch and consume NodeMCU Things
let fetchArray = [
  WoT.fetch("file://./tdPumpP101.jsonld"),
  WoT.fetch("file://./tdValveV102.jsonld"),
  WoT.fetch("file://./tdUltrasonicSensorB101.jsonld"),
  WoT.fetch("file://./tdB114.jsonld"),
  WoT.fetch("file://./tdB113.jsonld"),
  WoT.fetch("file://./tdS111.jsonld"),
  WoT.fetch("file://./tdS112.jsonld") ];

Promise.all(fetchArray).then( (tdArray) => {
  // order must match order of jsonld files
  let [tdPumpP101, tdValveV102, tdUltrasonicSensorB101, tdB114, tdB113, tdS111, tdS112] = tdArray;

  PumpP101 = WoT.consume(tdPumpP101); // Status
  ValveV102 = WoT.consume(tdValveV102); // Status

  let UltrasonicSensorB101 = WoT.consume(tdUltrasonicSensorB101); // level
  let LevelSensorB114 = WoT.consume(tdB114); // maxlevel101
  let LevelSensorB113 = WoT.consume(tdB113); // minlevel101

  let LevelSwitchS111 = WoT.consume(tdS111); // overflow101
  let FloatSwitchS112 = WoT.consume(tdS112); // overflow102

  // regularly sync state to exposed Thing
  setInterval( () => {
    let readArray = [
      PumpP101.properties.status.read(),
      ValveV102.properties.status.read(),
      UltrasonicSensorB101.properties.levelvalue.read(),
      FloatSwitchS112.properties.overflow102.read(),
      LevelSensorB114.properties.maxlevel101.read(),
      LevelSensorB113.properties.minlevel101.read(),
      LevelSwitchS111.properties.overflow101.read() ];

    Promise.all(readArray).then((resArray) => {
      // order must match order of read interactions
      let [ pumpStatus, valveStatus, levelvalue102, overflow102, maxlevel101, minlevel101, overflow101] = resArray;
      
      console.info("+++++++++++++++++++++++++++++++++++++++++++++");
      console.info("+++ PumpStatus  . . . . . . . " + pumpStatus);
      thing.properties.PumpStatus.write(pumpStatus==="ON" ? true : false);
      console.info("+++ ValveStatus . . . . . . . " + valveStatus);
      thing.properties.ValveStatus.write(valveStatus==="OPEN" ? true : false);
      console.info("+++ Tank102LevelValue . . . . " + levelvalue102);
      thing.properties.Tank102LevelValue.write(levelvalue102);
      console.info("+++ Tank102OverflowStatus . . " + overflow102);
      thing.properties.Tank102OverflowStatus.write(overflow102);
      console.info("+++ Tank101MaximumLevelStatus " + maxlevel101);
      thing.properties.Tank101MaximumLevelStatus.write(maxlevel101);
      console.info("+++ Tank101MinimumLevelStatus " + minlevel101);
      thing.properties.Tank101MinimumLevelStatus.write(minlevel101);
      console.info("+++ Tank101OverflowStatus . . " + overflow101);
      thing.properties.Tank101OverflowStatus.write(overflow101);

    }).catch( err => { console.error("+++ NodeMCU read error: " + err); });

  }, 5000);
});

// exposed Thing toward Oracle IoT Cloud Service
let thing = WoT.produce({
  id: "urn:dev:wot:siemens:festoscript",
  name: "FestoLive",
  "iotcs:deviceModel": "urn:com:siemens:wot:festo"
});

console.info(thing.name + " produced");

thing
  // actuator state
  .addProperty("PumpStatus", { type: "boolean", writable: false }, false)
  .addProperty("ValveStatus", { type: "boolean", writable: false }, false)

  // upper tank (102)
  .addProperty("Tank102LevelValue", { type: "number", writable: false }, 0.0)
  .addProperty("Tank102OverflowStatus", { type: "boolean", writable: false }, false)

  // lower tank (101)
  .addProperty("Tank101MaximumLevelStatus", { type: "boolean", writable: false }, false)
  .addProperty("Tank101MinimumLevelStatus", { type: "boolean", writable: false }, false)
  .addProperty("Tank101OverflowStatus", { type: "boolean", writable: false }, false)

  // actuators
  .addAction("StartPump", {}, () => {
      return new Promise((resolve, reject) => {
        console.info(">>> Startung pump!");
        if (live) PumpP101.actions.on.invoke()
          .then(() => { resolve(); })
          .catch((err) => { console.error("+++ StartPump invoke error: " + err); reject(err); });
        resolve();
      });
    })
  .addAction("StopPump", {}, () => {
      return new Promise((resolve, reject) => {
        console.info(">>> Stopping pump!");
        if (live) PumpP101.actions.off.invoke()
          .then(() => { resolve(); })
          .catch((err) => { console.error("+++ StopPump invoke error: " + err); reject(err); });
      });
    })
  .addAction("OpenValve", {}, () => {
      return new Promise((resolve, reject) => {
        console.info(">>> Opening valve!");
        if (live) ValveV102.actions.open.invoke()
          .then(() => { resolve(); })
          .catch((err) => { console.error("+++ OpenValve invoke error: " + err); reject(err); });
      });
    })
  .addAction("CloseValve", {}, () => {
      return new Promise((resolve, reject) => {
        console.info(">>> Closing valve!");
        if (live) ValveV102.actions.close.invoke()
          .then(() => { resolve(); })
          .catch((err) => { console.error("+++ CloseValve invoke error: " + err); reject(err); });
      });
    });

thing.expose()
  .then(() => { console.info(thing.name + " ready"); })
  .catch((err) => { console.error("Expose error: " + err); });

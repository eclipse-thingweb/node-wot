
  let thing = WoT.produce({
    id: "urn:dev:wot:siemens:festofake",
    name: "FestoFake",
    "iotcs:deviceModel": "urn:com:siemens:wot:festo"
  }
);

console.info(thing.name + " produced");

thing
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
        console.warn(">>> Startung pump!");
        resolve();
      });
    })
  .addAction("StopPump", {}, () => {
      return new Promise((resolve, reject) => {
        console.warn(">>> Stopping pump!");
        resolve();
      });
    })
  .addAction("OpenValve", {}, () => {
      return new Promise((resolve, reject) => {
        console.warn(">>> Opening valve!");
        resolve();
      });
    })
  .addAction("CloseValve", {}, () => {
      return new Promise((resolve, reject) => {
        console.warn(">>> Closing valve!");
        resolve();
      });
    });

thing.expose()
  .then(() => {
    console.info(thing.name + " ready");
    setInterval( () => {
      thing.properties.PumpStatus.write(Math.random()<0.5 ? true : false);
      thing.properties.ValveStatus.write(Math.random()<0.5 ? true : false);
      let level102 = Math.random() * 150;
      thing.properties.Tank102LevelValue.write(level102);
      thing.properties.Tank102OverflowStatus.write(level102 > 140);
      let level101 = 150 - level102;
      thing.properties.Tank101MaximumLevelStatus.write(level101 > 100);
      thing.properties.Tank101MinimumLevelStatus.write(level101 > 10);
      thing.properties.Tank101OverflowStatus.write(level101 > 140);
    }, 5000);
  })
  .catch((err) => { console.error("Expose error: " + err); });



WoTHelpers.fetch("http://localhost:8080/OAuth").then(td => {
    WoT.consume(td).then(async thing => {
        await thing.invokeAction("sayOk")
    })
})


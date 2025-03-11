/**
 * In the browser, node-wot only works in client mode with limited binding support.
 * Supported bindings: HTTP / HTTPS / WebSockets
 *
 * After adding the following <script> tag to your HTML page:
 * <script src="https://cdn.jsdelivr.net/npm/@node-wot/browser-bundle@latest/dist/wot-bundle.min.js" defer></script>
 *
 * you can access all node-wot functionality / supported packages through the "WoT" global object.
 * Examples:
 * var servient = new WoT.Core.Servient();
 * var client = new WoT.Http.HttpClient();
 *
 **/

// A URL to the smart coffee machine Thing Description
const TD_URL = "http://plugfest.thingweb.io:8083/smart-coffee-machine";
// How often to update the property values (in ms)
const UPDATE_PERIOD = 2000;

function get_td(addr) {
    servient.start().then((thingFactory) => {
        helpers
            .fetch(addr)
            .then((td) => {
                thingFactory.consume(td).then((thing) => {
                    showProperties(thing);
                });
            })
            .catch((error) => {
                window.alert("Could not fetch TD.\n" + error);
            });
    });
}

function showProperties(thing) {
    let td = thing.getThingDescription();
    let row = 0;
    for (let property in td.properties) {
        if (td.properties.hasOwnProperty(property)) {
            thing.readProperty(property).then(async (iOutput) => {
                const value = await iOutput.value();
                const el = document.getElementById(property);
                if (!el) {
                    // Create a property record if not found
                    const tbody = document.getElementById("properties").getElementsByTagName("tbody")[0];
                    const tr = document.createElement("tr");
                    tr.innerHTML = `<td><pre>${property}</pre></td><td id="${property}" class="property-value"><pre>${JSON.stringify(
                        value,
                        null,
                        2
                    )}</pre></td>`;
                    if (row % 2 !== 0) {
                        tr.style.background = "#FFFAF0";
                    }
                    tbody.appendChild(tr);
                    row++;
                } else {
                    // Otherwise just update its value
                    el.innerHTML = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
                }
            });
        }
    }
    // Update the property values after UPDATE_PERIOD time
    setTimeout(function () {
        showProperties(thing);
    }, UPDATE_PERIOD);
}

var servient = new WoT.Core.Servient();
servient.addClientFactory(new WoT.Http.HttpClientFactory());
var helpers = new WoT.Core.Helpers(servient);
get_td(TD_URL);

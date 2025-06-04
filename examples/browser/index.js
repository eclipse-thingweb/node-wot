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

function get_td(addr) {
    hideError();

    // Clear all loaded content before loading new TD
    const interactions = document.getElementById("interactions");
    if (interactions) {
        interactions.style.display = "none";
    }

    servient
        .start()
        .then((thingFactory) => {
            helpers
                .fetch(addr)
                .then((td) => {
                    thingFactory
                        .consume(td)
                        .then((thing) => {
                            removeInteractions();
                            showInteractions(thing);
                            updateTabDescription(addr, td);
                        })
                        .catch((err) => {
                            showError("Failed to consume TD: " + err);
                            clearAllInteractions();
                            updateTabDescription(addr, null, "Failed to consume TD: " + err);
                        });
                })
                .catch((err) => {
                    showError("Failed to fetch TD: " + err);
                    clearAllInteractions();
                    updateTabDescription(addr, null, "Failed to fetch TD: " + err);
                });
        })
        .catch((err) => {
            showError("Failed to start servient: " + err);
            clearAllInteractions();
            updateTabDescription(addr, null, "Failed to start servient: " + err);
        });
}

function showInteractions(thing) {
    let td = thing.getThingDescription();
    for (let property in td.properties) {
        if (td.properties.hasOwnProperty(property)) {
            let item = document.createElement("li");
            let link = document.createElement("a");
            link.appendChild(document.createTextNode(property));
            item.appendChild(link);
            document.getElementById("properties").appendChild(item);

            item.onclick = (click) => {
                thing
                    .readProperty(property)
                    .then(async (res) => window.alert(property + ": " + (await res.value())))
                    .catch((err) => window.alert("error: " + err));
            };
        }
    }
    for (let action in td.actions) {
        if (td.actions.hasOwnProperty(action)) {
            let item = document.createElement("li");
            let button = document.createElement("button");
            button.appendChild(document.createTextNode(action));
            button.className = "button tiny secondary";
            item.appendChild(button);
            document.getElementById("actions").appendChild(item);

            item.onclick = (click) => {
                showSchemaEditor(action, thing);
            };
        }
    }
    let eventSubscriptions = {};
    for (let evnt in td.events) {
        if (td.events.hasOwnProperty(evnt)) {
            let item = document.createElement("li");
            let link = document.createElement("a");
            link.appendChild(document.createTextNode(evnt));

            let checkbox = document.createElement("div");
            checkbox.className = "switch small";
            checkbox.innerHTML = '<input id="' + evnt + '" type="checkbox">\n<label for="' + evnt + '"></label>';
            item.appendChild(link);
            item.appendChild(checkbox);
            document.getElementById("events").appendChild(item);

            checkbox.onclick = (click) => {
                if (document.getElementById(evnt).checked && !eventSubscriptions[evnt]) {
                    console.log("Try subscribing for event: " + evnt);
                    thing
                        .subscribeEvent(evnt, async function (data) {
                            window.alert("Event " + evnt + " detected");
                        })
                        .then((sub) => {
                            eventSubscriptions[evnt] = sub;
                            console.log("Subscribed for event: " + evnt);
                        })
                        .catch((error) => {
                            window.alert("Event " + evnt + " error\nMessage: " + error);
                        });
                } else if (!document.getElementById(evnt).checked && eventSubscriptions[evnt]) {
                    console.log("Try to unsubscribing for event: " + evnt);
                    eventSubscriptions[evnt]
                        .stop()
                        .then(() => {
                            console.log("Unsubscribed for event: " + evnt);
                            eventSubscriptions[evnt] = undefined;
                        })
                        .catch((error) => {
                            window.alert("Event " + evnt + " error\nMessage: " + error);
                        });
                }
            };
        }
    }
    // Check if visible
    let placeholder = document.getElementById("interactions");
    if (placeholder.style.display === "none") {
        placeholder.style.display = "block";
    }
}

function removeInteractions() {
    for (id of ["properties", "actions", "events"]) {
        let placeholder = document.getElementById(id);
        while (placeholder.firstChild) {
            placeholder.removeChild(placeholder.firstChild);
        }
    }
}

function showSchemaEditor(action, thing) {
    let td = thing.getThingDescription();
    // Remove old editor
    removeSchemaEditor();

    let placeholder = document.getElementById("editor_holder");
    let editor;
    if (td.actions[action] && td.actions[action].input) {
        td.actions[action].input.title = action;
        editor = new JSONEditor(placeholder, {
            schema: td.actions[action].input,
            form_name_root: action,
        });
    }
    // Add invoke button
    let button = document.createElement("button");
    button.appendChild(document.createTextNode("Invoke"));
    placeholder.appendChild(button);

    button.onclick = () => {
        let input = editor ? editor.getValue() : undefined;
        thing
            .invokeAction(action, input)
            .then(async (res) => {
                if (typeof res === "object" && res.schema) {
                    window.alert("Success! Received response: " + (await res.value()));
                } else {
                    window.alert("Executed successfully.");
                }
            })
            .catch((err) => {
                window.alert(err);
            });
        removeSchemaEditor();
    };
}

function removeSchemaEditor() {
    let placeholder = document.getElementById("editor_holder");
    while (placeholder.firstChild) {
        placeholder.removeChild(placeholder.firstChild);
    }
}

// Error handling functions to show/hide error messages on web page instead of using alert window
function showError(message) {
    const errorContainer = document.getElementById("error-container");
    const errorText = document.getElementById("error-text");

    if (errorContainer && errorText) {
        errorText.textContent = message;
        errorContainer.style.display = "block";
    }
}

function hideError() {
    const errorContainer = document.getElementById("error-container");
    if (errorContainer) {
        errorContainer.style.display = "none";
    }
}

function updateTabDescription(url, td, error) {
    // Find active tab and update its description
    const activeTab = document.querySelector(".tabs-content .content.active");
    if (!activeTab) return;

    // Update URL link
    const urlElement = activeTab.querySelector(".td-url");
    if (urlElement && url) {
        urlElement.href = url;
        urlElement.textContent = url;
    }

    // Update description
    const descriptionElement = activeTab.querySelector(".td-description");
    if (!descriptionElement) return;

    if (error) {
        descriptionElement.textContent = error;
        descriptionElement.style.color = "red";
    } else if (td && td.description) {
        descriptionElement.textContent = td.description;
        descriptionElement.style.color = "";
    } else {
        descriptionElement.textContent = "No description available";
        descriptionElement.style.color = "";
    }
}

// Clear all interactions and editor
function clearAllInteractions() {
    console.log("clearAllInteractions function called");
    hideError();
    const interactions = document.getElementById("interactions");
    if (interactions) {
        interactions.style.display = "none";
    }
    ["properties", "actions", "events"].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = "";
    });
    removeSchemaEditor();
}

var servient = new WoT.Core.Servient();
servient.addClientFactory(new WoT.Http.HttpClientFactory());
var helpers = new WoT.Core.Helpers(servient);

// Tab configuration
const TD_URLS = {
    testthing: "http://plugfest.thingweb.io/http-data-schema-thing",
    smartcoffee: "http://plugfest.thingweb.io/http-advanced-coffee-machine",
    counter: "http://plugfest.thingweb.io/counter",
};

document.addEventListener("DOMContentLoaded", function () {
    // Parse URL parameters to pre-fill the input field
    let $_GET = location.search
        .substr(1)
        .split("&")
        .reduce((o, i) => ((u = decodeURIComponent), ([k, v] = i.split("=")), (o[u(k)] = v && u(v)), o), {});

    // Tab configuration in correct sequence
    const tabLinks = [
        { id: "tab-link-testthing", tab: "tab-testthing" },
        { id: "tab-link-smartcoffee", tab: "tab-smartcoffee" },
        { id: "tab-link-counter", tab: "tab-counter" },
        { id: "tab-link-custom", tab: "tab-custom" },
    ];

    const tdInput = document.getElementById("td_addr");
    const fetchBtn = document.getElementById("fetch");
    const closeErrorBtn = document.getElementById("close-error");

    // Error close button handler
    if (closeErrorBtn) {
        closeErrorBtn.onclick = (e) => {
            e.preventDefault();
            hideError();
        };
    }

    // Pre-fill input from URL parameter if provided
    if ($_GET["url"]) {
        tdInput.value = $_GET["url"];
    }

    // Tab click handlers
    tabLinks.forEach(({ id, tab }) => {
        const link = document.getElementById(id);
        if (link) {
            link.addEventListener("click", function (e) {
                e.preventDefault();
                clearAllInteractions();

                // Switch active tab
                document.querySelectorAll("#td-tabs .tab-title").forEach((li) => li.classList.remove("active"));
                link.parentElement.classList.add("active");
                document.querySelectorAll(".tabs-content .content").forEach((c) => c.classList.remove("active"));
                document.getElementById(tab).classList.add("active");

                // Auto-consume TD based on tab
                if (tab === "tab-testthing") {
                    get_td(TD_URLS.testthing);
                } else if (tab === "tab-smartcoffee") {
                    get_td(TD_URLS.smartcoffee);
                } else if (tab === "tab-counter") {
                    get_td(TD_URLS.counter);
                } else if (tab === "tab-custom") {
                    // Reset custom TD tab
                    const customDesc = document.querySelector("#tab-custom .td-description");
                    if (customDesc) {
                        customDesc.textContent = "Enter a TD URL above to consume it.";
                        customDesc.style.color = "";
                    }
                    const customUrl = document.querySelector("#tab-custom .td-url");
                    if (customUrl) {
                        customUrl.href = "";
                        customUrl.textContent = "";
                    }
                }
            });
        }
    });

    // Custom TD fetch button
    if (fetchBtn) {
        fetchBtn.onclick = () => {
            if (tdInput.value) {
                get_td(tdInput.value);
            } else {
                showError("Please enter a valid URL.");
            }
        };
    }

    // Auto-load TD if URL parameter was provided
    if ($_GET["url"]) {
        document.querySelectorAll("#td-tabs .tab-title").forEach((li) => li.classList.remove("active"));
        document.getElementById("tab-link-custom").parentElement.classList.add("active");
        document.querySelectorAll(".tabs-content .content").forEach((c) => c.classList.remove("active"));
        document.getElementById("tab-custom").classList.add("active");
        get_td($_GET["url"]);
    } else {
        // Default to Test Thing tab
        document.getElementById("tab-link-testthing").click();
    }
});

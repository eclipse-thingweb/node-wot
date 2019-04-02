/**
 * In the browser, node wot only works in client mode with limited binding support.
 * Supported bindings: HTTP / HTTPS / WebSockets
 * 
 * After adding the following <script> tag to your HTML page:
 * <script src="https://cdn.jsdelivr.net/npm/@node-wot/browser-bundle@latest/dist/wot-bundle.min.js" defer></script>
 * 
 * you can access all node-wot functionality / supported packages through the "Wot" global object. 
 * Examples: 
 * var servient = new Wot.Core.Servient(); 
 * var client = new Wot.Http.HttpClient();
 * 
 **/ 


var servient = new Wot.Core.Servient();
servient.addClientFactory(new Wot.Http.HttpClientFactory());

function get_td(addr) {
	servient.start().then((thingFactory) => {
		thingFactory.fetch(addr).then((td) => {
			var thing = thingFactory.consume(td)

			// Remove old editor and add new one
			for (id of ["properties", "actions", "events"]) {
				let placeholder = document.getElementById(id);
				while (placeholder.firstChild){
    				placeholder.removeChild(placeholder.firstChild);
				}
			}

			for ( let property in thing.properties ) {
				if (thing.properties.hasOwnProperty(property)) {
					let item = document.createElement("li");
					let link = document.createElement("a");
					link.appendChild(document.createTextNode(property));
					item.appendChild(link);
					document.getElementById("properties").appendChild(item);

					item.onclick = (click) => {
						thing.properties[property].read()
						.then(res => window.alert(property + ": " + res))
						.catch(err => window.alert("error: " + err))
					}
					// Check if visible
					let placeholder = document.getElementById("interactions")
					if ( placeholder.style.display === "none") {
						placeholder.style.display = "block"
					}
				}
			};

			for ( let action in thing.actions ) {
				if (thing.actions.hasOwnProperty(action)) {
					let item = document.createElement("li");
					let button = document.createElement("button");
					button.appendChild(document.createTextNode(action));
					button.className = "button tiny secondary"
					item.appendChild(button)
					document.getElementById("actions").appendChild(item);

					item.onclick = (click) => { 
						showSchemaEditor(action, thing) 
					}

					// Check if visible
					let placeholder = document.getElementById("interactions")
					if ( placeholder.style.display === "none") {
						placeholder.style.display = "block"
					}
				}
			};

			for ( let evnt in thing.events ) {
				if (thing.events.hasOwnProperty(evnt)) {
					let item = document.createElement("li");
					let link = document.createElement("a");
					link.appendChild(document.createTextNode(evnt));
					link.href = thing.events[evnt].forms[0].href
					item.appendChild(link);
					document.getElementById("events").appendChild(item);

					// Check if visible
					let placeholder = document.getElementById("interactions")
					if ( placeholder.style.display === "none") {
						placeholder.style.display = "block"
					}
				}
			};

		}).catch((error) => {
			window.alert("Could not fetch TD.\n" + error)
		})
	})
}

function showSchemaEditor(action, thing) {
	// Remove old editor
	let placeholder = document.getElementById('editor_holder');
	hideSchemaEditor()

	let editor;
	if (thing.actions[action] && thing.actions[action].input ) {  
		thing.actions[action].input.title = action
		editor = new JSONEditor(
			placeholder, 
			{
				schema: thing.actions[action].input,
				form_name_root: action
			}
		);
	}
	// Add invoke button
	let button = document.createElement("button")
	button.appendChild(document.createTextNode("Invoke"))
	placeholder.appendChild(button)

	button.onclick = () => { 
		let input = editor ? editor.getValue() : "";
		thing.actions[action].invoke(input)
		.then((res) => { 
			if (res) {
				window.alert("Sucess! Received response: " + res)
			} else {
				window.alert("Executed successfully.")
			}
		})
		.catch((err) => { window.alert(err) })
		hideSchemaEditor()
	};

	// Show div
	placeholder.style.display = "block"
}

function hideSchemaEditor() {
	let placeholder = document.getElementById('editor_holder');
	while (placeholder.firstChild){
    	placeholder.removeChild(placeholder.firstChild);
	}
}

document.getElementById("fetch").onclick = () => { get_td(document.getElementById("td_addr").value);  };

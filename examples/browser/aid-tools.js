/**
 * In the browser, node-wot only works in client mode with limited support.
 *
 * After adding the following <script> tag to your HTML page:
 * <script src="https://cdn.jsdelivr.net/npm/@node-wot/browser-bundle@latest/dist/wot-bundle.min.js" defer></script>
 *
 * you can access all node-wot functionality / supported packages through the "Wot" global object.
 * Examples:
 * var assetInterfaceDescriptionUtil = new Wot.Tools.AssetInterfaceDescriptionUtil();
 * var servient = new Wot.Core.Servient();
 * var client = new Wot.Http.HttpClient();
 *
 **/

async function transform_to_td() {
    let fileElement = document.getElementById("fileInput");

    // check if user has selected a file
    if (fileElement.files.length === 0) {
        alert("Please choose a file");
        return;
    }

    var fileReader = new FileReader();
    fileReader.onload = function (fileLoadedEvent) {
        var aidFromFileLoaded = fileLoadedEvent.target.result;
        const template = { title: "AID-Conversion" };
        let tdAID = assetInterfaceDescriptionUtil.transformAAS2TD(aidFromFileLoaded, JSON.stringify(template));
        // let's pretty print the result
        tdAID = JSON.stringify(JSON.parse(tdAID), null, 2);
        // Note
        document.getElementById("tdJSON").value = tdAID;
        editorJSON.setValue(tdAID);
    };
    fileReader.readAsText(fileElement.files[0], "UTF-8");
}

var assetInterfaceDescriptionUtil = new Wot.Tools.AssetInterfaceDescriptionUtil();

document.getElementById("transform").onclick = () => {
    transform_to_td();
};

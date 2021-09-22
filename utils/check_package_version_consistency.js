const fs = require("fs");
const path = require("path");

const doDebug = false;
async function main() {
    const dependencies = {};

    async function exploreFolder(folderToExplore) {
        const subFolders = await fs.promises.readdir(folderToExplore);
        for (const subFolder of subFolders) {
            const folderPath = path.join(folderToExplore, subFolder);
            const packagejson = path.join(folderPath, "package.json");
            if (fs.existsSync(packagejson)) {
                if (doDebug) {
                    console.log("exploring ", folderPath);
                }
                const packageJson = JSON.parse(await fs.promises.readFile(packagejson, "utf8"));
                if (packageJson.dependencies) {
                    for (const [moduleName, version] of Object.entries(packageJson.dependencies).concat(
                        Object.entries(packageJson.devDependencies)
                    )) {
                        dependencies[moduleName] = dependencies[moduleName] || {};
                        dependencies[moduleName][version] = dependencies[moduleName][version] || [];
                        dependencies[moduleName][version].push(subFolder);
                    }
                }
            }
        }
    }

    const rootFolder = path.join(__dirname, "..");
    await exploreFolder(path.join(rootFolder, "packages"));
    await exploreFolder(path.join(rootFolder, "examples/servients"));
    await exploreFolder(path.join(rootFolder, "examples/templates"));
    await exploreFolder(path.join(rootFolder, "examples/security"));

    let nbErrors = 0;
    // finding the packages that are present with multiple versions
    for (const [module, versionPackages] of Object.entries(dependencies)) {
        const versions = Object.keys(versionPackages);
        if (versions.length !== 1) {
            console.log("Warning module ", module, " has multiple versions ", versions.join(" "));
            console.log(versionPackages);
            nbErrors++;
        }
    }
    if (nbErrors > 0) {
        console.log(" => Please fix the error above first and rerun");
        process.exit(1);
    }

    const oftenUsedPackages = [];
    const rarelyUsedPackages = [];
    for (const [module, versionPackages] of Object.entries(dependencies)) {
        if (module.match(/^@node-wot/)) {
            continue;
        }
        const theVersion = Object.keys(versionPackages)[0];
        const usedInMoreThanOne = versionPackages[theVersion].length > 1;
        if (usedInMoreThanOne) {
            if (doDebug) {
                console.log("considering package that is used more than once: ", module);
            }
            oftenUsedPackages.push(`"${module}": "${theVersion}",`);
        } else {
            if (doDebug) {
                console.log("ignoring package that is only used once: ", module);
            }
            rarelyUsedPackages.push(`"${module}": "${theVersion}",`);
        }
    }

    console.log("Good ! the version number of all modules used are all consistent !");

    const displayOftenUsedPackages = false;
    if (displayOftenUsedPackages) {
        //  ---
        console.log("\nSuggestion: now you can manually update the devDependencies section of the main package.json");
        console.log(
            "with the following packages. Those packages are installed  more than once in one of the sub modules"
        );

        console.log("-----------\n");

        console.log(oftenUsedPackages.sort().join("\n"));
    }
    process.exit(0);
}

main();

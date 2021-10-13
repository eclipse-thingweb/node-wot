/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const fs = require("fs");

const doDebug = false;
async function main() {
    const dependencies = {};

    async function exploreModule(folderPath) {
        const folder = path.basename(folderPath);

        const packageFilename = path.join(folderPath, "package.json");
        if (fs.existsSync(packageFilename)) {
            if (doDebug) {
                console.log("exploring ", folderPath);
            }
            const packageJson = JSON.parse(await fs.promises.readFile(packageFilename, "utf8"));
            if (packageJson.dependencies || packageJson.devDependencies) {
                const modules = Object.entries(packageJson.dependencies || []).concat(
                    Object.entries(packageJson.devDependencies || [])
                );
                for (const [moduleName, version] of modules) {
                    dependencies[moduleName] = dependencies[moduleName] || {};
                    dependencies[moduleName][version] = dependencies[moduleName][version] || [];
                    dependencies[moduleName][version].push(folder);
                }
                if (doDebug) {
                    console.log(folder);
                    console.log(modules);
                }
            }
        }
    }
    async function exploreFolder(folderToExplore) {
        const subFolders = await fs.promises.readdir(folderToExplore);
        for (const subFolder of subFolders) {
            const folderPath = path.join(folderToExplore, subFolder);
            exploreModule(folderPath);
        }
    }

    const rootFolder = path.join(__dirname, "..");
    await exploreModule(rootFolder);
    await exploreFolder(path.join(rootFolder, "packages"));
    await exploreFolder(path.join(rootFolder, "examples"));
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

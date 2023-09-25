/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const fs = require("fs");

const doDebug = false;
async function main() {
    const allDependencies = {};
    const devDependencies = {};

    async function exploreModule(folderPath) {
        const folder = path.basename(folderPath);

        const packageFilename = path.join(folderPath, "package.json");
        if (fs.existsSync(packageFilename)) {
            if (doDebug) {
                console.log("exploring ", folderPath);
            }
            const packageJson = JSON.parse(await fs.promises.readFile(packageFilename, "utf8"));
            for (const [modules, isDevDependencies] of [
                [packageJson.dependencies ?? {}, false],
                [packageJson.devDependencies ?? {}, true],
            ]) {
                const dependencyCollections = [allDependencies];

                // devDependencies are recorded a second time for a redundancy check
                if (isDevDependencies) {
                    dependencyCollections.push(devDependencies);
                }

                for (const [moduleName, version] of Object.entries(modules)) {
                    for (const dependencyCollection of dependencyCollections) {
                        dependencyCollection[moduleName] ??= {};
                        dependencyCollection[moduleName][version] ??= [];
                        dependencyCollection[moduleName][version].push(folder);
                    }
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
    await exploreFolder(path.join(rootFolder, "examples/templates"));
    await exploreFolder(path.join(rootFolder, "examples/security"));

    let nbErrors = 0;
    // finding the packages that are present with multiple versions
    for (const collectedDepedencies of [allDependencies, devDependencies]) {
        for (const [module, versionPackages] of Object.entries(collectedDepedencies)) {
            const versions = Object.keys(versionPackages);
            if (versions.length !== 1) {
                console.log("Warning module ", module, " has multiple versions ", versions.join(" "));
                console.log(versionPackages);
                nbErrors++;
            }
        }
    }
    if (nbErrors > 0) {
        console.log(" => Please fix the error above first and rerun");
        process.exit(1);
    }

    // Check for redundant devDependencies and exit with error if there is a duplicate
    const oftenUsedPackages = [];
    const rarelyUsedPackages = [];
    for (const [module, versionPackages] of Object.entries(devDependencies)) {
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

    if (oftenUsedPackages.length > 0) {
        console.log("The following packages are installed more than once.");
        console.log("Please move them manually to the devDependencies section of the main package.json.");
        console.log("-----------\n");

        console.log(oftenUsedPackages.sort().join("\n"));
        process.exit(1);
    }

    console.log("Good! The version numbers of all modules used are consistent.");
    process.exit(0);
}

(async () => {
    try {
        await main();
    } catch (e) {
        console.error(e);
        process.exit(3);
    }
})();

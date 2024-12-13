const { build } = require("esbuild");
const { polyfillNode } = require("esbuild-plugin-polyfill-node");
const { rimraf } = require("rimraf");
const fs = require("fs");

const outdir = "dist";

/**
 * @type {import('esbuild').BuildOptions}
 */
const options = {
    entryPoints: ["index.ts"],
    bundle: true,
    outfile: `${outdir}/wot-bundle.js`,
    format: "iife",
    platform: "browser",
    globalName: "WoT",
    sourcemap: true,
    plugins: [
        polyfillNode({
            globals: {
                global: false,
                __dirname: false,
                __filename: false,
                buffer: true,
                process: false,
            },
        }),
    ],
};

async function run() {
    const start = Date.now();
    await rimraf(outdir);
    await build(options);

    options.minify = true;
    options.outfile = `${outdir}/wot-bundle.min.js`;
    await build(options);

    options.minify = false;
    options.entryPoints = ["index.ts", "../binding-http", "../core", "../binding-websockets"];
    options.splitting = true;
    options.outfile = undefined;
    options.outdir = `${outdir}/esm`;
    options.format = "esm";
    options.treeShaking = true;

    await build(options);

    console.log(`Build time: ${Date.now() - start}ms`);

    console.log("Build output:");
    await displaySizes(`${outdir}`);
}

async function displaySizes(path) {
    // log generated files with their size in KB
    const files = fs.readdirSync(path);
    for (const file of files) {
        const stat = fs.statSync(`${path}/${file}`);
        if (stat.isDirectory()) {
            displaySizes(`${path}/${file}`);
            continue;
        }
        console.log(`- ${path}/${file} ${Math.round((stat.size / 1024) * 100) / 100} KB`);
    }
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});

const { readFileSync, writeFileSync } = require("fs");

const schema = readFileSync("./src/wot-servient-schema.conf.json", "utf8");
const package = readFileSync("./package.json", "utf8");
const { version } = JSON.parse(package);

writeFileSync(
    "./src/generated/wot-servient-schema.conf.ts",
    `const schema = ${schema.trimEnd()} as const \nexport default schema;`
);
writeFileSync("./src/generated/version.ts", `const version = "${version}" as const \nexport default version;`);

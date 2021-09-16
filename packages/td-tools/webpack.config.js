const path = require("path");

module.exports = {
    mode: "production",
    entry: "./src/td-tools.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "node-wot-td-tools.bundle.js",
        library: "TDTools",
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [{ test: /\.ts$/, loader: "ts-loader" }],
    },
};

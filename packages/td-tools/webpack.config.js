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
        fallback: {
            http: require.resolve("stream-http"),
            https: require.resolve("https-browserify"),
            fs: false,
        },
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [{ test: /\.ts$/, loader: "ts-loader" }],
    },
};

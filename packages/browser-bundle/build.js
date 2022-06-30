const browserify = require("browserify");
const builtIns = require("browserify/lib/builtins");

const stream = require.resolve("readable-stream4/lib/stream");
const _stream_duplex = require.resolve("readable-stream4/lib/_stream_duplex");
const _stream_passthrough = require.resolve("readable-stream4/lib/_stream_passthrough");
const _stream_readable = require.resolve("readable-stream4/lib/_stream_readable");
const _stream_transform = require.resolve("readable-stream4/lib/_stream_transform");
const _stream_writable = require.resolve("readable-stream4/lib/_stream_writable");

const fs = require("fs");

const builder = browserify({
    ...builtIns,
    stream,
    _stream_duplex,
    _stream_passthrough,
    _stream_readable,
    _stream_transform,
    _stream_writable,
});

builder.add("./index.js");

const bundleStream = builder.bundle();

if (!fs.existsSync("./dist")) {
    fs.mkdirSync("./dist");
}

const output = fs.createWriteStream("./dist/wot-bundle.min.js");
bundleStream.pipe(output, { end: true });

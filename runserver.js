"use strict";
GLOBAL.CONFIG_FILE = "./config.js";
if (process.argv.length > 2) {
    GLOBAL.CONFIG_FILE = "./" + process.argv[2];
}
var s = require("./server.js").Server();

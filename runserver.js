"use strict";
GLOBAL.CONFIG_FILE = "./config.js";
if (process.argv.length > 2) {
    GLOBAL.CONFIG_FILE = "./" + process.argv[2];
}

var requirejs = require('requirejs');
var dirname = typeof __dirname === 'undefined' ? "/eggsofdoom" : __dirname;
requirejs.config({
    //Pass the top-level main.js/index.js require
    //function to requirejs so that node modules
    //are loaded relative to the top-level JS file.
    nodeRequire: require,
    baseUrl: dirname
});

requirejs([CONFIG_FILE], function(config) {
    config.CONFIG.gamedep = config.CONFIG.game_package + "/game";
    GLOBAL.CONFIG = config.CONFIG;
    requirejs(["server"], function(server) {
        server.Server();
    });
});


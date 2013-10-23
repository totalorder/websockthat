"use strict";

GLOBAL.CONFIG_FILE = "./config.js";
var assert = require("assert");
var mocks = require('./mocks.js');
var server = require('../server.js');
var communication = require("../communication.js");
var config = require("../" + CONFIG_FILE);
var websocktransport = require('../websocktransport.js');
var world = require('../world.js');

suite('world', function () {
    var c1, c2, new_world, game = require("../" + config.CONFIG.game_package + "/game.js");

    setup(function () {
        // Get the server rollin'
        var _tick_sender = websocktransport.WebSocketTickSender(),
            _options = game.createDefaultOptions();

        // Passing a TickSender along to the world all simulation output will go through it out to our clients
        new_world = world.World(_tick_sender, null, null, _options, false);
        c1 = { id: 0,
            name: 'c1',
            web_socket: new mocks.WebSocket(),
            input_receiver: new mocks.WebSocketInputReceiver(),
            color: 'orange' };
        c2 = { id: 1,
            name: 'c2',
            web_socket: new mocks.WebSocket(),
            input_receiver: new mocks.WebSocketInputReceiver(),
            color: 'green' };
    });

    teardown(function () {
        new_world.stop();
    });

    test('force stop', function (done) {
        assert.equal(new_world.isRunning(), false);
        new_world.startGame([c1, c2], function () {
            assert.equal(new_world.isRunning(), false);
            done();
        });
        assert.equal(new_world.isRunning(), true);
        new_world.stop();
    });

    test('game ends', function (done) {
        // Tell the simulator that these are test clients and that it should
        // try to end the game quickly
        c1.test_client = 1;
        c2.test_client = 2;
        assert.equal(new_world.isRunning(), false);
        new_world.startGame([c1, c2], function () {
            assert.equal(new_world.isRunning(), false);
            done();
        });
    });
});

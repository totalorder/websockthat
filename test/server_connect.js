"use strict";

var assert = require("assert");
var mocks = require('./mocks.js');
var s;
suite('server_connect', function () {
    setup(function () {
        // Get the server rollin'
        var server = require('../server.js');
        s = server.Server();
    });

    teardown(function () {
        s.stop();
    });

    test('server instantiation', function () {
        assert.notEqual(s, undefined);
        assert.notEqual(s, null);
        console.log(s);
    });

    test('game setup', function () {
        assert.equal(s.getGameOnGame().getNumberOfClients(), 0);
        assert.equal(s.getRunningGames().length, 1);
    });

    test('client connect', function () {
        assert.equal(s.getGameOnGame().getNumberOfClients(), 0);
        s.getWebSocketServer().emit('connection', new mocks.WebSocket());
        assert.equal(s.getGameOnGame().getNumberOfClients(), 1);
    });
});

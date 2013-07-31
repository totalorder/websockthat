"use strict";

var assert = require("assert");
var mocks = require('./mocks.js');
var communication = require("../communication.js");
var s;
suite('server', function () {
    setup(function () {
        // Get the server rollin'
        var server = require('../server.js');
        s = server.Server();
    });

    teardown(function () {
        s.stop();
    });

    test('instantiates', function () {
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

    test('game cleanup', function () {
        var c1 = new mocks.WebSocket(),
            c2 = new mocks.WebSocket();

        // Start a new game by connecting two players
        assert.equal(s.getRunningGames().length, 1);
        s.getWebSocketServer().emit('connection', c1);
        s.getWebSocketServer().emit('connection', c2);

        // Verify that a new empty game is created and we have 2 games in total
        assert.equal(s.getGameOnGame().getNumberOfClients(), 0);
        assert.equal(s.getRunningGames().length, 2);

        // Disconnect both players and verify that only one game remains
        c1.triggerOnSendErrorCallback("disconnect c1");
        assert.equal(s.getRunningGames().length, 2);
        c2.triggerOnSendErrorCallback("disconnect c2");
        assert.equal(s.getRunningGames().length, 1);
    });
});

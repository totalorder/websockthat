"use strict";

var assert = require("assert");
var mocks = require('./mocks.js');
var communication = require("../communication.js");
var config = require("../config.js");

suite('server', function () {
    var s, osc;
    setup(function () {
        osc = config.CONFIG.start_countdown;
        config.CONFIG.start_countdown = 0;
        config.CONFIG.bind_to_address = '127.0.0.1';
        config.CONFIG.bind_to_port = 9999;
        config.CONFIG.connect_to_address = '127.0.0.1';
        config.CONFIG.connect_to_port = 9999;
        config.CONFIG.max_players = 2;
        config.CONFIG.min_players = 1;

        // Get the server rollin'
        var server = require('../server.js');
        s = server.Server();
    });

    teardown(function () {
        s.stop();
        config.CONFIG.start_countdown = osc;
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
            c2 = new mocks.WebSocket(),
            c3 = new mocks.WebSocket();

        // Start a new game by connecting two players
        assert.equal(s.getRunningGames().length, 1);

        // Connect two clients, filling up the first game
        s.getWebSocketServer().emit('connection', c1);
        s.getWebSocketServer().emit('connection', c2);

        // Connect one more to create the new game-on-game
        s.getWebSocketServer().emit('connection', c3);

        // Verify that a new game is created and we have 2 games in total
        assert.equal(s.getGameOnGame().getNumberOfClients(), 1);
        assert.equal(s.getRunningGames().length, 2);

        // This is the game_on_game and should be kept
        c3.triggerOnSendErrorCallback("disconnect c3");
        assert.equal(s.getRunningGames().length, 2);

        c1.triggerOnSendErrorCallback("disconnect c1");
        assert.equal(s.getRunningGames().length, 2);

        // Last player in the first game leaves
        // Make sure the game is cleaned up
        c2.triggerOnSendErrorCallback("disconnect c2");
        assert.equal(s.getRunningGames().length, 1);
    });

    test('join during game', function () {
        var c1 = new mocks.WebSocket(),
            c2 = new mocks.WebSocket();

        // Start game 1
        s.getWebSocketServer().emit('connection', c1);
        c1.receivePacket(communication.createHelloPacket("c1"));
        c1.receivePacket(communication.createStartPacket());

        // Connect client 2
        s.getWebSocketServer().emit('connection', c2);
        c2.receivePacket(communication.createHelloPacket("c1"));
        c2.receivePacket(communication.createStartPacket());

        // Make sure the two players are in different games
        assert.equal(s.getGameOnGame().getNumberOfClients(), 1);
        assert.equal(s.getRunningGames().length, 2);
    });
});

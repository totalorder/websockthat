"use strict";

var assert = require("assert");
var mocks = require('./mocks.js');
var server = require('../server.js');
var communication = require("../communication.js");
var g, c1, c2, game_over_callback_called;
suite('game', function () {
    setup(function () {
        // Get the server rollin'
        /*var server = require('../server.js');
        s = server.Server();*/
        game_over_callback_called = false;
        g = server.Game(0, 1, 2, function (game) {
            game_over_callback_called = true;
        });
        c1 = mocks.WebSocket();
        c2 = mocks.WebSocket();
    });

    teardown(function () {
        //s.stop();
    });

    test('start', function () {
        g.newConnection(0, c1);
        g.newConnection(1, c2);
        c1.receivePacket(communication.createHelloPacket("c1"));
        c2.receivePacket(communication.createHelloPacket("c2"));
        assert.equal(g.getNumberOfClients(), 2);
        assert.equal(g.hasStarted(), true);
        assert.equal(g.isRunning(), true);
    });

    test('ends on disconnect', function () {
        g.newConnection(0, c1);
        g.newConnection(1, c2);
        c1.receivePacket(communication.createHelloPacket("c1"));
        c2.receivePacket(communication.createHelloPacket("c2"));
        assert.equal(g.getNumberOfClients(), 2);
        assert.equal(g.isRunning(), true);
        c1.triggerOnSendErrorCallback("test disconnect");
        assert.equal(g.getNumberOfClients(), 1);
        assert.equal(g.isRunning(), false);
    });

    test('deletes on all disconnected', function () {
        g.newConnection(0, c1);
        g.newConnection(1, c2);
        c1.receivePacket(communication.createHelloPacket("c1"));
        c2.receivePacket(communication.createHelloPacket("c2"));
        assert.equal(g.getNumberOfClients(), 2);
        assert.equal(g.isRunning(), true);
        assert.equal(game_over_callback_called, false);
        c1.triggerOnSendErrorCallback("test disconnect");
        c2.triggerOnSendErrorCallback("test disconnect");
        assert.equal(g.getNumberOfClients(), 0);
        assert.equal(g.isRunning(), false);
        assert.equal(g.hasStarted(), false);
        assert.equal(game_over_callback_called, true);
    });

});

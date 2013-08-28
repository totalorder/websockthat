"use strict";

var assert = require("assert");
var mocks = require('./mocks.js');
var server = require('../server.js');
var communication = require("../communication.js");
var config = require("../config.js");

suite('game', function () {
    var osc, g, c1, c2, game_over_callback_called;
    setup(function () {
        osc = config.CONFIG.start_countdown;
        config.CONFIG.start_countdown = 0;
        config.CONFIG.bind_to_port = 9999;
        config.CONFIG.connect_to_port = 9999;

        game_over_callback_called = false;
        g = new server.Game(0, 1, 2, function () {
            game_over_callback_called = true;
        });
        c1 = mocks.WebSocket();
        c2 = mocks.WebSocket();
    });

    teardown(function () {
        config.CONFIG.start_countdown = osc;
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

    test('restart', function (done) {
        g.setTestMode(true);
        g.newConnection(0, c1);
        g.newConnection(1, c2);
        assert.equal(g.getNumberOfClients(), 2);
        assert.equal(g.isRunning(), false);
        c1.receivePacket(communication.createHelloPacket("c1"));
        c2.receivePacket(communication.createHelloPacket("c2"));
        assert.equal(g.isRunning(), true);
        c1.sendObject = function (obj) {
            if (obj.type === communication.PACKET_TYPES.GAME_OVER) {
                // Pause this thread to let the Game to the housekeeping and update the isRunning-state
                setTimeout(function () {
                    assert.equal(g.isRunning(), false);
                    c1.receivePacket(communication.createStartPacket());
                    c2.receivePacket(communication.createStartPacket());
                    assert.equal(g.isRunning(), true);
                    c1.triggerOnSendErrorCallback("c1 disconnect");
                    c2.triggerOnSendErrorCallback("c2 disconnect");
                    assert.equal(g.isRunning(), false);
                    done();
                }, 0);
            }
        };
    });
});

"use strict";

var assert = require("assert");
var mocks = require('./mocks.js');
var communication = require("../communication.js");
var websocktransport = require('../websocktransport.js');
var world = require('../world.js');
var _ = require('underscore')._;
var config = require("../config.js");
var server = require("../server.js");


suite('fuzz', function () {
    var osc, s, game = require("../" + config.CONFIG.game_package + ".js");

    setup(function () {
        osc = config.CONFIG.start_countdown;
        config.CONFIG.start_countdown = 0;
        config.CONFIG.bind_to_port = 9999;
        config.CONFIG.connect_to_port = 9999;
        config.CONFIG.max_players = 2;

        game.setTestOptions(true);
        // Get the server rollin'
        var server = require('../server.js');
        s = server.Server();
    });

    teardown(function () {
        s.stop();
        game.setTestOptions(false);
        config.CONFIG.start_countdown = osc;
    });

    test('long', function (done) {
        this.timeout(5000);

        var clients = 10,
            alive_clients = 0;
        _.each(_.range(clients), function (index) {
            var sock = new mocks.WebSocket();
            sock.runs = 0;
            sock.test_id = index;

            sock.sendObject = function (obj) {
                if (obj.type === communication.PACKET_TYPES.GAME_OVER) {
                    setTimeout(function () {
                        sock.runs += 1;
                        if (sock.test_id < 5 && sock.runs > 4) {
                            sock.triggerOnSendErrorCallback("c" + sock.test_id + " disconnect");
                            alive_clients -= 1;
                        } else if (sock.runs > 9) {
                            sock.triggerOnSendErrorCallback("c" + sock.test_id + " disconnect");
                            alive_clients -= 1;
                        } else {
                            sock.receivePacket(communication.createStartPacket());
                        }

                        if (alive_clients === 0) {
                            assert.equal(s.getRunningGames().length, 1);
                            assert.equal(s.getGameOnGame().getNumberOfClients(), 0);
                            console.log("games created: " + s.getNextGameID() + "\n" +
                                        "games cleaned up: " + s.getCleanedUpGames() + "\n" +
                                        "games played: " + s.getTotalGamesPlayed());
                            done();
                        }
                    }, 0);
                }
            };

            alive_clients += 1;
            s.getWebSocketServer().emit('connection', sock);
            sock.receivePacket(communication.createHelloPacket("c" + index));
        });
    });

});

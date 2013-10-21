"use strict";

var communication = require("./communication.js");
var websocktransport = require("./websocktransport.js");
var world = require("./world.js");
var input = require("./input.js");
var config = require("./config.js");
var ui = require("./ui.js");

var _ = require('underscore')._;


(function () { // Don't pollute the global namespace
    var local_player_settings = null,
        is_touch_device = 'ontouchstart' in document.documentElement,
        client_world = null,
        _ui = new ui.UI(".game-area", "#canvas", ".stats-box", ".toast", ".lobby"),
        start_key_text = is_touch_device ? "Touch screen" : "Press space",

        _init = function () {
            // Create a new WebSocket client
            var web_socket = new window.WebSocket('ws://' + config.CONFIG.connect_to_address + ':' + config.CONFIG.connect_to_port + '/'),
                player_name = window.location.search.split("?screen_name=")[1];
                // Set up settings for the local player
                local_player_settings = {
                    name :  null,
                    keys : {
                        left : 37,
                        right : 40,
                        start : 32}
            };

            _ui.init();

            if(!player_name) {
                player_name = "Anynomous";
            }

            local_player_settings.name = player_name;

            // Add .sendObject() .onobject() and .registerReceivedPacketCallback() to our WebSocket-object
            websocktransport.addWebSocketObjectSupport(web_socket);

            _waitForConnectionOpen(web_socket);
        },

        /*
         * Wait until our connection is open and then create a World, WebSocketTickReceiver and LocalInputDevice.
         * Hook up the LocalInputDevice to listen for among other keys the "START" key.
         *
         * Then we start listening to packets of the type START_DATA which will arrive when all players have
         * pressed the "START" key
         */
        _waitForConnectionOpen = function (web_socket) {
            console.log("waiting for connection open");
            web_socket.onopen = function() {
                _ui.createToast("Waiting for other players...", start_key_text + " to start");

                // Send a HELLO to the server, telling it our name and that we're interested in chatting with it
                web_socket.sendObject(communication.createHelloPacket(local_player_settings.name));

                // Set up an InputHandler that will listen for and react to all incoming data that is about the in-game
                // action
                var tick_receiver = websocktransport.WebSocketTickReceiver(web_socket),
                    input_sender = new websocktransport.WebSocketInputSender(web_socket),

                // Set up an InputDevice that will listen to the keys pressed by the user and react to them
                // Passing along specialKeyCommandsCallback that will send a START packet to the server when
                // the InputDevice detects the START-input-event
                    input_device = new input.LocalInputDevice(local_player_settings.keys, function (command) {
                        if (command === input.COMMANDS.START) {
                            web_socket.sendObject(communication.createStartPacket());
                            console.log("waiting for players packet!");
                        }
                });

                // Simulate keypresses when getting input from touch
                // Expects click to be -1, 0 or 1 for left, release, right
                // Will interpret any touch as "start"-key
                _ui.setClickCallback(function (click) {
                    if (click === 0) {
                        input_device.doKeyUp({preventDefault: function(){}, keyCode: local_player_settings.keys.left});
                        input_device.doKeyUp({preventDefault: function(){}, keyCode: local_player_settings.keys.right});
                    } else if (click < 0) {
                        input_device.doKeyUp({preventDefault: function(){}, keyCode: local_player_settings.keys.right});
                        input_device.doKeyDown({preventDefault: function(){}, keyCode: local_player_settings.keys.left});
                    } else {
                        input_device.doKeyUp({preventDefault: function(){}, keyCode: local_player_settings.keys.left});
                        input_device.doKeyDown({preventDefault: function(){}, keyCode: local_player_settings.keys.right});
                    }
                    input_device.doKeyDown({preventDefault: function(){}, keyCode: local_player_settings.keys.start});
                    input_device.doKeyUp({preventDefault: function(){}, keyCode: local_player_settings.keys.start});
                });

                _registerForStartDataPackets(web_socket, input_device, input_sender, tick_receiver);

                _registerForGameOverPackets(web_socket);

                _registerForLobbyStatePackets(web_socket);

                // We're all set up. Wait for our player (and all other players) to press start, and let the game begin!
                console.log("PRESS START!");
            };
        },

        _registerForStartDataPackets = function (web_socket, input_device, input_sender, tick_receiver) {
            /*
             * Register for incoming packets of the type START_DATA and set up the game world, and start it.
             * Sets our LocalInputDevice as the input for the local player and passes along a WebSocketInputSender
             * that will relay all input-commands to the server
             */
            web_socket.registerReceivedPacketCallback(communication.PACKET_TYPES.START_DATA, null, function (packet) {

                // Create a new World passing along the game-options received from the server
                // Passing in our WebSocketTickReceiver will let the World notify it when the game starts and what
                // players will be in the game. The InputHandler will then be able to input data directly into
                // the players
                client_world = new world.World(null, input_sender, tick_receiver, packet.options, true);

                // Set the input_device for the local player to our LocalInputDevice and set it's input_sender
                // to a WebSocketInputSender that will relay all input-commands to the server
                _.each(packet.players, function (player_data) {
                    if(player_data.you) {
                        player_data.input_device = input_device;
                        player_data.input_handler = input_sender;
                    }
                });

                _ui.hideToast();

                // Start the game, giving it a list of player_data-objects
                client_world.startGame(packet.players);
                console.log("started!");
            });
        },

        _registerForGameOverPackets = function (web_socket) {
            // Register for incoming packets of the type GAME_OVER and notify the World if the server says it's game over
            web_socket.registerReceivedPacketCallback(communication.PACKET_TYPES.GAME_OVER, null, function (packet) {
                console.log("GAME OVER!");
                client_world.gameOver();
                _ui.createToast("Game over! " + start_key_text + " to play again...");
            });
        },

        _registerForLobbyStatePackets = function (web_socket) {
            // Register for incoming pakcets of the type LOBBY_STATE
            web_socket.registerReceivedPacketCallback(communication.PACKET_TYPES.LOBBY_STATE, null, function (packet) {
                _ui.clearStatsBox();

                var info = document.createElement("li");
                info.innerHTML = packet.connected_players + "/" + packet.max_players + " connected, " +
                    packet.players_ready + "/" + packet.min_players + " ready";
                _ui.createToast("Waiting for other players...", start_key_text + " to start! (" + (packet.connected_players - packet.players_ready) + " players not ready)");

                _ui.addStatsBoxLine(info);
                _.each(packet.player_infos, function (player_info) {
                    var player_info_li = document.createElement("li"),
                        player_score_span = document.createElement("span"),
                        player_state_span = document.createElement("span");
                    player_info_li.appendChild(player_score_span);
                    player_info_li.appendChild(player_state_span);
                    player_score_span.innerHTML = "<b>" + (player_info.name || "Anonymous") + ": " + player_info.score + "</b> ";
                    player_state_span.innerHTML = player_info.is_ready ? "Ready" : "Not ready";
                    player_state_span.setAttribute('style', "color: gray; font-style: italic;");
                    if (player_info.color !== null) {
                        player_score_span.setAttribute('style', "color: " + player_info.color + ";");
                    }
                    _ui.addStatsBoxLine(player_info_li);
                });

                if (packet.prepare_for_start) {
                    _ui.startToastCountdown(packet.prepare_for_start);
                }
            });
        };

    window.onload = _init;
})();


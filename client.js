
var shared = require("./shared.js");
var world = require("./world.js");
var input = require("./input.js");
var config = require("./config.js");

var _ = require('underscore')._;


(function () { // Don't pollute the global namespace

    // Create a new WebSocket client
    var web_socket = new window.WebSocket('ws://' + config.CONFIG.connect_to_address + ':' + config.CONFIG.connect_to_port + '/');

    // Set up settings for the local player
    var local_player_settings = {
        name : 'anton',
        keys : {
            left : 37,
            right : 40,
            start : 32}
    };

    var lobby_ul = document.getElementById("lobby");

    // Add .sendObject() .onobject() and .registerReceivedPacketCallback() to our WebSocket-object
    shared.addWebSocketObjectSupport(web_socket);

    console.log("waiting for connection open");

    /*
     * Wait until our connection is open and then create a World, WSReceivingInputHandler and LocalInputDevice.
     * Hook up the LocalInputDevice to listen for among other keys the "START" key.
     *
     * Then we start listening to packets of the type START_DATA which will arrive when all players have
     * pressed the "START" key
     */
    web_socket.onopen = function() {
        // Send a HELLO to the server, telling it our name and that we're interested in chatting with it
        web_socket.sendObject(shared.createHelloPacket(local_player_settings.name));

        // Set up an InputHandler that will listen for and react to all incoming data that is about the in-game
        // action
        var client_input_handler = shared.WSReceivingInputHandler(web_socket);
        var client_world = null;

        var input_handler = new shared.WSSendingInputHandler(web_socket);

        // Set up an InputDevice that will listen to the keys pressed by the user and react to them
        // Passing along specialKeyCommandsCallback that will send a START packet to the server when
        // the InputDevice detects the START-input-event
        // TODO: Should not need to supply the input_handler to the InputDevice
        var input_device = new input.LocalInputDevice(local_player_settings.keys, input_handler.onInputReceived, function (command) {
            if (command === input.COMMANDS.START) {
                web_socket.sendObject(shared.createStartPacket());
                console.log("waiting for players packet!");
            }
        });

        /*
         * Register for incoming packets of the type START_DATA and set up the game world, and start it.
         * Sets our LocalInputDevice as the input for the local player and passes along a WSSendingInputHandler
         * that will relay all input-commands to the server
         */
        web_socket.registerReceivedPacketCallback(shared.PACKET_TYPES.START_DATA, null, function (packet) {

            // Create a new World passing along the game-options received from the server
            // Passing in our WSReceivingInputHandler will let the World notify it when the game starts and what
            // players will be in the game. The InputHandler will then be able to input data directly into
            // the players
            client_world = new world.World(client_input_handler, null, packet.options, true);

            // Set the input_device for the local player to our LocalInputDevice and set it's input_handler
            // to a WSSendingInputHandler that will relay all input-commands to the server
            for (var i = 0; i < packet.players.length; i++) {
                var player_data = packet.players[i];
                if(player_data.you) {
                    player_data.input_device = input_device;
                    player_data.input_handler = input_handler;
                }
            }

            // Start the game, giving it a list of player_data-objects
            client_world.startGame(packet.players);
            console.log("started!");
        });

        // Register for incoming pakcets of the type GAME_OVER and notify the World if the server says it's game over
        web_socket.registerReceivedPacketCallback(shared.PACKET_TYPES.GAME_OVER, null, function (packet) {
            console.log("GAME OVER!");
            client_world.gameOver();
        });

        // Register for incoming pakcets of the type LOBBy_STATE
        web_socket.registerReceivedPacketCallback(shared.PACKET_TYPES.LOBBY_STATE, null, function (packet) {
            while (lobby_ul.hasChildNodes()) {
                lobby_ul.removeChild(lobby_ul.lastChild);
            }

            var info = document.createElement("li");
            info.innerHTML = packet.connected_players + "/" + packet.max_players + " connected<br />" +
                             packet.players_ready + "/" + packet.min_players + " ready";
            lobby_ul.appendChild(info);
            _.each(packet.player_infos, function (player_info) {
                var player_info_li = document.createElement("li");
                player_info_li.innerHTML = (player_info.name || "Anonymous") + ": " + (player_info.ready ? "Ready" : "Not ready");
                if (player_info.color !== null) {
                    player_info_li.setAttribute('style', "color: " + player_info.color + ";");
                }
                lobby_ul.appendChild(player_info_li);
            });
            //document.createElement("div");
        });

        // We're all set up. Wait for our player (and all other players) to press start, and let the game begin!
        console.log("PRESS START!");
    };
})();


var shared = require("./shared.js");
var world = require("./world.js");
var input = require("./input.js");

(function () { // Don't pollute the global namespace

    // Create a new WebSocket client
    var webSocket = new window.WebSocket('ws://127.0.0.1:8006');

    // Set up settings for the local player
    var localPlayerSettings = {
        name : 'anton',
        keys : {
            left : 37,
            right : 40,
            start : 32}
    };

    // Add .sendObject() .onobject() and .registerReceivedPacketCallback() to our WebSocket-object
    shared.addWebSocketObjectSupport(webSocket);

    console.log("waiting for connection open");

    /*
     * Wait until our connection is open and then create a World, ClientInputHandler and LocalInputDevice.
     * Hook up the LocalInputDevice to listen for among other keys the "START" key.
     *
     * Then we start listening to packets of the type START_DATA which will arrive when all players have
     * pressed the "START" key
     */
    webSocket.onopen = function() {
        // Send a HELLO to the server, telling it our name and that we're interested in chatting with it
        webSocket.sendObject(shared.createHelloPacket(localPlayerSettings.name));

        // Set up an InputHandler that will listen for and react to all incoming data that is about the in-game
        // action
        var clientInputHandler = shared.ClientInputHandler(webSocket);
        var clientWorld = null;

        // Set up an InputDevice that will listen to the keys pressed by the user and react to them
        // Passing along specialKeyCommandsCallback that will send a START packet to the server when
        // the InputDevice detects the START-input-event
        var input_device = new input.LocalInputDevice(localPlayerSettings.keys, function (command) {
            if (command == input.COMMANDS.START) {
                webSocket.sendObject(shared.createStartPacket());
                console.log("waiting for players packet!");
            }
        });

        /*
         * Register for incoming packets of the type START_DATA and set up the game world, and start it.
         * Sets our LocalInputDevice as the input for the local player and passes along a RemoteWSInputHandler
         * that will relay all input-commands to the server
         */
        webSocket.registerReceivedPacketCallback(shared.PACKET_TYPES.START_DATA, function (packet) { return packet }, function (packet) {

            // Create a new World passing along the game-options received from the server
            // Passing in our ClientInputHandler will let the World notify it when the game starts and what
            // players will be in the game. The InputHandler will then be able to input data directly into
            // the players
            clientWorld = new world.World(clientInputHandler, null, packet.options);

            // Set the input_device for the local player to our LocalInputDevice and set it's input_handler
            // to a RemoteWSInputHandler that will relay all input-commands to the server
            for (var i = 0; i < packet.players.length; i++) {
                var player_data = packet.players[i];
                if(player_data.you) {
                    player_data.input_device = input_device;
                    player_data.input_handler = new input.RemoteWSInputHandler(webSocket);
                }
            }

            // Start the game, giving it a list of player_data-objects
            clientWorld.startGame(packet.players);
            console.log("started!");
        });

        // Register for incoming pakcets of the type GAME_OVER and notify the World if the server says it's game over
        webSocket.registerReceivedPacketCallback(shared.PACKET_TYPES.GAME_OVER, function (packet) { return packet }, function (packet) {
            console.log("GAME OVER!");
            clientWorld.gameOver();
        });

        // We're all set up. Wait for our player (and all other players) to press start, and let the game begin!
        console.log("PRESS START!");
    };
})();


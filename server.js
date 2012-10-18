var WebSocketServer = require('ws').Server,
    shared = require('./shared.js'),
    world = require('./world.js'),
    input = require('./input.js');
    player = require('./player.js');

(function(exports){
    /**
     * A server that listens for/to incoming websocket connections and starts a game when all players have
     * requested it
     */
    exports.Server = function () {
        // Create a new WebSocketServer and start listening
        var address = {host: '127.0.0.1', port: 8006};
        var webSocketServer = new WebSocketServer(address);
        console.log("listening to ", address);

        // Set up an output handler, default options and create a World
        var outputHandler = shared.ServerOutputHandler();
        var clients = [];
        var options = shared.createDefaultOptions();
        var theWorld = world.World(null, outputHandler, options);
        var gameRunning = false;
        var nextClientID = 0;

        /**
         * Listen for new connections on webSocketServer and set up listeners for all new clients
         * Also add all new clients to the list "clients" which will be the basis for creating all players
         *
         */
        webSocketServer.on('connection', function(clientWebSocket) {
            console.log("got connection!");

            // Set up a data structure that will hold data about the newly connected client
            var client_data = {
                webSocket : clientWebSocket,
                id : nextClientID
            };

            // Tell the outputHandler that we have a new client that should receive updates
            outputHandler.addClientWS(client_data);

            // Increment the nextClientID, that will be used to ID the next client
            nextClientID++;

            // Enhance the websocket with object support
            shared.addWebSocketObjectSupport(clientWebSocket);

            // Add the client to our list of clients
            clients.push(client_data);

            /**
             * Listen to HELLOs from the client and create the player_data object for the client when received
             * TODO: Use registerReceivedPacketCallback instead
             * @param packet
             */
            clientWebSocket.onobject = function (packet) {
                if (packet.type == shared.PACKET_TYPES.HELLO) {
                    console.log("received HELLO from player", packet.name);

                    // Set up the player_data-structure
                    client_data.player_data = {id: client_data.id, name : packet.name};
                }
            };

            /**
             * Register for incoming packets of the type START
             * When we receive a START, we set up an InputDevice and an InputHandler, and if all players have sent a
             * START, let the games begin!
             * TODO: Start listening AFTER we have received a HELLO!
             */
            clientWebSocket.registerReceivedPacketCallback(shared.PACKET_TYPES.START, function (packet) { return packet }, function (packet) {
                if (gameRunning) {
                    return null;
                }
                console.log("received START from player", client_data.player_data.name);

                // Create an InputDevice that will listen to incoming websocket data
                // TODO: Refactor this
                var ws_input_device = input.WSInputDevice();

                // Create an InputHandler that will apply all the commands received by
                // the InputDevice to the player-object
                var local_input_handler = input.LocalInputHandler();

                // Hook up the InputDevice.onInputCallback to all incoming packets of type INPUT
                // from the clients websocket
                clientWebSocket.registerReceivedPacketCallback(shared.PACKET_TYPES.INPUT, function (packet) { return packet.command; }, ws_input_device.onInputCallback);

                // Set up the client_data with the InputDevice and InputHandler and
                client_data.player_data.input_device = ws_input_device;
                client_data.player_data.input_handler = local_input_handler;
                // Mark the current client that it wants to start
                client_data.start = true;

                // Check if all clients have asked to start the game
                var allStarted = true;
                for (var i = 0; i < clients.length; i++) {
                    var client = clients[i];
                    if (!client.start) {
                        allStarted = false;
                    }
                }

                // If all clients have asked to start, let the games begin!
                if (allStarted) {

                    // Gather all player_data objects and pass them to theWorld!
                    //var player_infos = [];
                    var player_datas = [];
                    for (i = 0; i < clients.length; i++) {
                        client_data = clients[i];
                        //var player_info = {id: client_data.player_data.id, name : client_data.player_data.name };
                        //player_infos.push(player_info);
                        player_datas.push(client.player_data);
                    }

                    /**
                     * Start the game, supplying it with data our player_datas.
                     * Define a _restartCallback for the world to execute when the game ends that
                     * will set all clients to .start = false and set gameRunning to false.
                     */
                    theWorld.startGame(player_datas, function () {
                        for (var i = 0; i < clients.length; i++) {
                            clients[i].start = false;
                        }
                        gameRunning = false;
                    });
                    gameRunning = true;
                }
            });
        });
    }
})(typeof exports === 'undefined'? this['server']={}: exports);

var server = require('./server.js');

// Get the server rollin'
var s = server.Server();
/**
 * Websocket based server for the game engine Sockworld
 * Supplies a game lobby and game hosting for any game running in the Sockworld engine
 *
 * This script will automatically start a new server when run
 *
 * Exports:
 *  Server: Websocket server that hosts a lobby and games
 *  Game: A game that can keep serving a number of clients
 *  Client: A client that can participage in a Game
 *  getColorForID: Returns the html-color associated with a specific ID
 */

"use strict";

var WebSocketServer = require('ws').Server,
    communication = require("./communication.js"),
    websocktransport = require('./websocktransport.js'),
    world = require('./world.js'),
    input = require('./input.js'),
    config = require("./config.js"),
    game = require("./" + config.CONFIG.game_package + ".js");

var _ = require('underscore')._;

(function (exports) {
    /**
     * A server that listens for new connections and distributes new clients over Games. A game is started when it's
     * reached it's maximum player limit or when a certain amount of clients has asked to start.
     * When a game is full or started a new game will be created that new players will be directed to, always keeping a lobby
     * open for new players.
     */
    exports.Server = function () {
        // The id for the next created game. Incremented each time new game is created
        var next_game_id = 0,

            /**
             * Constructor for the server object
             * Create a new game and start listening for connections. Create a new game
             * when the previous one is full.
             *
             * @constructor
             */
            _init = function () {


                var address = { host: config.CONFIG.bind_to_address,
                    port: config.CONFIG.bind_to_port },
                    // Create a new WebSocketServer and start listening
                    web_socket_server = new WebSocketServer(address),
                    next_client_id = 0,

                    // Create a new game setting it as the current "game_on_game"
                    // The game on game is the one new players connecting will be directed to
                    _game_on_game = _createGameOnGame(),

                    // A list of all games running
                    // Should be cleaned up for dead games once in a while
                    _running_games = [];

                console.log("listening to ", address);

                /**
                 * Listen for new connections on web_socket_server and set up listeners for all new clients
                 * Also add all new clients to the list "clients" which will be the basis for creating all players
                 *
                 * @param client_web_socket - A WebSocket connected to a newly connected client
                 */
                web_socket_server.on('connection', function (client_web_socket) {

                    // Increment the next_client_id, that will be used to ID the next client
                    next_client_id += 1;

                    // Enhance the websocket with object support
                    websocktransport.addWebSocketObjectSupport(client_web_socket);

                    // Tell the current game on game that we have a new player for it
                    _game_on_game.newConnection(next_client_id, client_web_socket);

                    // Create a new game on game if the current one has started or is full
                    // If the game becomes full and someone leaves before it starts, it will never receive any
                    // new players. This could be a potential problem is games are not autostarted when full
                    if (_game_on_game.hasStarted() || _game_on_game.hasMaxClients()) {
                        _running_games.push(_game_on_game);
                        _game_on_game = _createGameOnGame();
                    }
                });
            },

            /**
             * Create and return a new game for use as a "game on game"
             *
             * @returns Game - A game pre-configured with default settings
             */
            _createGameOnGame = function () {
                next_game_id += 1;
                return new exports.Game(next_game_id, 1, 2);
        };

        // Execute the constructor
        _init();
    };

    /**
     * A game hosting a number of clients and their requests to start/restart
     * Will start is >= min_clients wants to start or if max_clients is reached
     *
     * @param id - The id of the game
     * @param min_clients - The minimum amount of clients that's needed to start a game
     * @param max_clients - The maximum amount of clients that can be reached before the game is autostarted
     */
    exports.Game = function (id, min_clients, max_clients) {
        var _max_clients = max_clients,
            _min_clients = min_clients,
            _id = id,
            _tick_sender = null,
            _options = null,
            _world = null,
            _clients = [],
            _is_running = false,
            _has_started = false,

            init = function () {
                // Set up an TickSender, default options and create a World
                _tick_sender = websocktransport.WebSocketTickSender();
                _options = game.createDefaultOptions();

                // Passing a TickSender along to the world all simulation output will go through it out to our clients
                _world = world.World(_tick_sender, null, null, _options, false);
            },

            /**
             * Returns true if the max number of clients have been reached
             *
             * @returns bool
             */
            _hasMaxClients = function () {
                if (_max_clients === null) {
                    throw "cannot check hasMaxClients when no max is set!";
                }

                return _clients.length === _max_clients;
            },

            /**
             * Create a lobby state packet containing information about all players connected to the game
             * Including player id, name, ready-state and color
             *
             * @returns communication.PACKET_TYPES.LOBBY_STATE
             */
            _createLobbyStatePacket = function () {
                var player_infos = [];
                _.each(_clients, function (client) {
                    player_infos.push({id: client.getID(), name : client.getName(), is_ready : client.isReady(), 'color': client.getColor()});
                });

                return communication.createLobbyStatePacket(_min_clients, _max_clients, _clients.length, _getNumberOfClientsReady(), player_infos);
            },

            /**
             * Send a packet to all clients
             *
             * @param packet - Any type of packet defined in communication.PACKET_TYPES
             */
            _sendPacketToAllClients = function (packet) {
                _.each(_clients, function (client) {
                    client.getWebSocket().sendObject(packet);
                });
            },

            /**
             * Send lobby packets to all clients
             */
            _sendLobbyPackets = function () {
                _sendPacketToAllClients(_createLobbyStatePacket());
            },

            /**
             * Start the game. Collect client player data and start the world with it
             * Give _restart() as the _restartCallback to the world so it will be called when it's safe to restart
             */
            _start = function () {
                console.log("starting game " + _id);
                // Set the state of the game to running
                _is_running = true;
                _has_started = true;

                console.log("starting game with " + _clients.length + "clients");

                // Gather player data from each player
                var player_datas = [];
                _.each(_clients, function (client) {
                    // Set up the client_data with the InputDevice and InputHandler and
                    client.start();

                    // Gather all player_data objects and pass them to the world!
                    player_datas.push(client.getData());
                });

                // Start the game, supplying it with data our player_datas.
                // Define a _restartCallback for the world to execute when the game ends that
                // will set all clients to .start = false and set gameRunning to false.
                _world.startGame(player_datas, function () {
                            _restart();
                        });
            },

            /**
             * Returns the number of clients that have send the "START"-command
             *
             * @returns number - The number of clients that have sent the "START"-command
             */
            _getNumberOfClientsReady = function () {
                return _.filter(_clients, function (client) { return client.isReady(); }).length;
            },

            /**
             * Returns true if all clients are set up
             *
             * Yes, we all know that clients is plural and it should be _areAllClientsSetUp - but its so hard to fight
             * the urge to obediently obey the is/has-pattern!
             *
             * @returns bool
             */
            _isAllClientsSetUp = function () {
                return _.all(_clients, function (client) { return client.isSetUp(); });
            },

            /**
             * Listen for START-packets from the given client and start the game if enough players send START
             */
            _listenForStart = function (client) {
                var start_handler = client.getWebSocket().registerReceivedPacketCallback(communication.PACKET_TYPES.START, null, function (packet) {
                    // Unregister the listener so that we don't care about any START-packets until the game restarts again
                    client.getWebSocket().unregisterReceivedPacketCallback(start_handler);

                    // Tell the client-object we received a start packet from it's socket
                    client.gotStart();

                    // Start the game if >= _min_clients have sent a START
                    if(_clients.length >= _min_clients && _getNumberOfClientsReady() === _clients.length ) {
                        _start();
                    }
                });
            },

            /**
             * Start listening for START-messages from all clients
             */
            _restart = function () {
                _is_running = false;
                _.each(_clients, function (client) {
                    _listenForStart(client);
                });
            },

            /**
             * Receive a new connection from the Server, setting up a Client and waiting to start
             */
            _newConnection = function (id, web_socket) {
                console.log("new connection with id " + id);
                // The local_client_id is a game-unique ID that can repeat when clients are disconnecting and connecting
                // It is picked as the lowest in a continious series starting from 0, increasing with each player and
                // re-using id's of disconnected players to create a series with as few holes as possible.
                // The local id's are used to give each player a unique color

                // For example:
                // If three players connect to an empty game, their local-ids will be: 0, 1, 2.
                // If player 1 disconnects, the local ids will be: 0, 2
                // If a fourth player connects, it will fill the first hole in the series, eg 1 and
                // the local ids will be 0,1,2 again

                var local_client_id = _clients.length,
                    client = null,
                    hello_handler = null;

                // Calculate the next local_client_id
                _.some(_clients, function (client, index) {
                    if (client.getLocalID() !==  index) {
                        local_client_id = index;
                        return true; // Simulate a "break;"
                    }
                    return null;
                });

                // Create a new client
                client = exports.Client(id, local_client_id, web_socket);

                /**
                 * Listen for a HELLO-packet from the client, setting up the client name and marking it as "ready"
                 * when it has arrived
                 */
                hello_handler = web_socket.registerReceivedPacketCallback(communication.PACKET_TYPES.HELLO, null, function (packet) {
                    // Unregister the hello_handler since we don't want the client to be able to change his/her name
                    // at an arbitrary time later on.
                    web_socket.unregisterReceivedPacketCallback(hello_handler);

                    // Tell the client it's new name!
                    client.gotHello(packet.name);

                    // Tell everyone our name!
                    _sendLobbyPackets();

                    // Tell the tick_sender that we have a new client that should receive updates
                    // This will enable the simulator to send tick-data to the client through the tick_sender
                    _tick_sender.addClient(client.getData());

                    // If the game is maxed and all clients are set up, start the game!
                    if (_hasMaxClients() && _isAllClientsSetUp()) {
                        _start();
                        return;
                    }

                    // If we have a minimum clients set, listen for START-packages
                    if (_min_clients !== null) {
                        _listenForStart(client);
                    }
                });

                // Add the client to our list of active clients
                _clients.push(client);

                /**
                 * Set the onSendErrorCallback on the clients WebSocket. It will be called if the websocket server
                 * receives an exception when trying to send to the client. This will be seen as the client has disconnected
                 * So we remove the client from our _clients-list and tell the tick_sender it shouldn't receive any
                 * further updates.
                 */
                web_socket.setOnSendErrorCallback(function (message) {
                    console.log("error when sending to client " + client.getID() + ": " + message +"\n" +
                        "removing player...");
                    _clients.splice(_clients.indexOf(client), 1);
                    _tick_sender.removeClient(client.getID());
                    console.log(_clients.length + " clients active");
                });

                // Tell everyone that someone has joined!
                _sendLobbyPackets();
        };

        // Execute the constructor
        init();

        return {
            getNumberOfClients : function () {
                return _clients.length;
            },

            hasMaxClients: _hasMaxClients,

            newConnection: _newConnection,

            restart: _restart,

            isRunning : function () {
                return _is_running;
            },

            hasStarted : function () {
                return _has_started;
            }
        };
    };

    /**
     * A client as represented in the server
     * Mostly holds state
     *
     * @param id - The unique id of the client
     * @param local_id - The game-unique local_id of the client
     * @param web_socket - The web_socket-connection connected to the client
     */
    exports.Client = function (id, local_id, web_socket) {
        var _id = id,
            _local_id = local_id,

            // Get a color for the client based on it's local_id
            _color = exports.getColorForID(local_id),

            _web_socket = web_socket,
            _hello = false,
            _name = null,
            _got_start = false,

            // Create a new WebSocketInputReceiver listening to the clients web_socket
            _input_receiver = input.WebSocketInputReceiver(web_socket, id);

        return {
            getData : function () {
                return {id : _id, name: _name, webSocket: _web_socket, input_receiver: _input_receiver, color: _color };
            },

            getID : function () {
                return _id;
            },

            getLocalID : function () {
                return _local_id;
            },

            getName : function () {
                return _name;
            },

            getColor : function () {
                return _color;
            },

            getWebSocket: function () {
                return _web_socket;
            },

            gotHello: function (name) {
                _hello = true;
                _name = name;
            },

            gotStart: function () {
                _got_start = true;
            },

            isSetUp: function () {
                return _hello;
            },

            isReady: function () {
                return _got_start;
            },

            start : function () {
                _input_receiver.start();
                _got_start = false;
            },

            stop : function () {

            }
        };
    };

    /**
     * Returns a color based on an id
     * Picks from a list using modulo to wrap around it when we run out of colors
     *
     * @param id
     * @return string - A html-color (any of the formats accepted by browsers, eg rgb(), #hex or blue
     */
    exports.getColorForID = function (id) {
        var colors = {
            0 : "orange",
            1 : "green",
            2 : "purple",
            3 : "cyan",
            4: "red",
            5: "blue"
        };
        return colors[id % _.keys(colors).length];
    };

})(typeof exports === 'undefined'? this['server']={}: exports);

var server = require('./server.js');

// Get the server rollin'
var s = server.Server();
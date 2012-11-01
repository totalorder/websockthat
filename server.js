"use strict";

var WebSocketServer = require('ws').Server,
    communication = require("./communication.js"),
    shared = require('./shared.js'),
    world = require('./world.js'),
    input = require('./input.js'),
    config = require("./config.js"),
    game = require("./" + config.CONFIG.game_package + ".js");

var _ = require('underscore')._;

(function (exports) {
    /**
     * A server that listens for/to incoming websocket connections and starts a game when all players have
     * requested it
     */
    exports.Server = function () {
        var next_game_id = 0,
            _init = function () {

                // Create a new WebSocketServer and start listening
                var address = { host: config.CONFIG.bind_to_address,
                    port: config.CONFIG.bind_to_port },
                    web_socket_server = new WebSocketServer(address),
                    next_client_id = 0,
                    next_game_id = 0,
                    _game_on_game = _createGameOnGame(),
                    _running_games = [];

                console.log("listening to ", address);

                /**
                 * Listen for new connections on web_socket_server and set up listeners for all new clients
                 * Also add all new clients to the list "clients" which will be the basis for creating all players
                 */
                web_socket_server.on('connection', function (client_web_socket) {

                    // Increment the next_client_id, that will be used to ID the next client
                    // TODO: Not thread safe?
                    next_client_id += 1;

                    // Enhance the websocket with object support
                    shared.addWebSocketObjectSupport(client_web_socket);

                    _game_on_game.newConnection(next_client_id, client_web_socket);
                    if (_game_on_game.hasStarted() || _game_on_game.hasMaxClients()) {
                        _running_games.push(_game_on_game);
                        _game_on_game = _createGameOnGame();
                    }
                });
            },

            _createGameOnGame = function () {
                next_game_id += 1;
                return new exports.Game(next_game_id, 1, 2);
        };

        _init();
    };

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
                // Set up an output handler, default options and create a World
                _tick_sender = shared.WebSocketTickSender();
                _options = game.createDefaultOptions();

                _world = world.World(_tick_sender, null, null, _options);
            },

            _hasMaxClients = function () {
                if (_max_clients === null) {
                    throw "cannot check hasMaxClients when no max is set!";
                }

                return _clients.length === _max_clients;
            },

            _createLobbyStatePacket = function () {
                var player_infos = [];
                _.each(_clients, function (client) {
                    player_infos.push({id: client.getID(), name : client.getName(), is_ready : client.isReady(), 'color': client.getColor()});
                });

                return communication.createLobbyStatePacket(_min_clients, _max_clients, _clients.length, _getNumberOfClientsReady(), player_infos);
            },

            _sendPacketToAllClients = function (packet) {
                _.each(_clients, function (client) {
                    client.getWebSocket().sendObject(packet);
                });
            },

            _sendLobbyPackets = function () {
                _sendPacketToAllClients(_createLobbyStatePacket());
            },

            _start = function () {
                console.log("starting game " + _id);
                _is_running = true;
                _has_started = true;
                var player_datas = [];

                console.log("starting game with " + _clients.length + "clients");
                _.each(_clients, function (client) {
                    // Set up the client_data with the InputDevice and InputHandler and
                    client.start();

                    // Gather all player_data objects and pass them to the world!
                    //var player_infos = [];
                    player_datas.push(client.getData());
                });

                /**
                * Start the game, supplying it with data our player_datas.
                * Define a _restartCallback for the world to execute when the game ends that
                * will set all clients to .start = false and set gameRunning to false.
                */
                _world.startGame(player_datas, function () {
                            _restart();
                        });
            },

            _getNumberOfClientsReady = function () {
                return _.filter(_clients, function (client) { return client.isReady(); }).length;
            },

            _isAllClientsSetUp = function () {
                return _.all(_clients, function (client) { return client.isSetUp(); });
            },

            _listenForStart = function (client) {
                var start_handler = client.getWebSocket().registerReceivedPacketCallback(communication.PACKET_TYPES.START, null, function (packet) {
                    client.getWebSocket().unregisterReceivedPacketCallback(start_handler);
                    client.gotStart();
                    if(_clients.length >= _min_clients && _getNumberOfClientsReady() === _clients.length ) {
                        _start();
                    }
                });
            },

            _restart = function () {
                _is_running = false;
                _.each(_clients, function (client) {
                    _listenForStart(client);
                });
            },

            _newConnection = function (id, web_socket) {
                console.log("new connection with id " + id);
                var local_client_id = _clients.length,
                    client = null,
                    hello_handler = null;

                _.some(_clients, function (client, index) {
                    if (client.getLocalID() !==  index) {
                        local_client_id = index;
                        return true; // Simulate a "break;"
                    }
                    return null;
                });

                client = exports.Client(id, local_client_id, web_socket);
                // Listen to HELLOs from the client
                hello_handler = web_socket.registerReceivedPacketCallback(communication.PACKET_TYPES.HELLO, null, function (packet) {
                    web_socket.unregisterReceivedPacketCallback(hello_handler);
                    client.gotHello(packet.name);

                    _sendLobbyPackets(); // Tell everyone our name!

                    // Tell the outputHandler that we have a new client that should receive updates
                    _tick_sender.addClient(client.getData());

                    if (_hasMaxClients() && _isAllClientsSetUp()) {
                        _start();
                        return;
                    }

                    if (_min_clients !== null) {
                        _listenForStart(client);
                    }
                });

                _clients.push(client);
                web_socket.setOnSendErrorCallback(function (message) {
                    console.log("error when sending to client " + client.getID() + ": " + message +"\n" +
                        "removing player...");
                    _clients.splice(_clients.indexOf(client), 1);
                    _tick_sender.removeClient(client.getID());
                    console.log(_clients.length + " clients active");
                });

                _sendLobbyPackets(); // Tell everyone that someone has joined!
        };

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

    exports.Client = function (id, local_id, web_socket) {
        var _id = id,
            _local_id = local_id,
            _color = shared.getColorForID(local_id),

            _web_socket = web_socket,
            _hello = false,
            _name = null,
            _got_start = false,
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
})(typeof exports === 'undefined'? this['server']={}: exports);

var server = require('./server.js');

// Get the server rollin'
var s = server.Server();
var WebSocketServer = require('ws').Server,
    shared = require('./shared.js'),
    world = require('./world.js'),
    input = require('./input.js'),
    player = require('./player.js'),
    config = require("./config.js"),
    game = require("./" + config.CONFIG.game_package + ".js");

var _ = require('underscore')._;

(function (exports) {
    /**
     * A server that listens for/to incoming websocket connections and starts a game when all players have
     * requested it
     */
    exports.Server = function () {

        var _createGameOnGame = function () {
                next_game_id += 1;
                return new exports.Game(next_game_id, 1, 2);
            },

            // Create a new WebSocketServer and start listening
            address = {host: config.CONFIG.bind_to_address, port: config.CONFIG.bind_to_port},
            web_socket_server = new WebSocketServer(address),
            next_client_id = 0,
            next_game_id = 0,
            _game_on_game = _createGameOnGame(),
            _running_games = [];

        console.log("listening to ", address);

        /**
         * Listen for new connections on web_socket_server and set up listeners for all new clients
         * Also add all new clients to the list "clients" which will be the basis for creating all players
         *
         */
        web_socket_server.on('connection', function (clientWebSocket) {

            // Enhance the websocket with object support
            shared.addWebSocketObjectSupport(clientWebSocket);

            // Increment the next_client_id, that will be used to ID the next client
            // TODO: Not thread safe?
            next_client_id += 1;

            _game_on_game.newConnection(next_client_id, clientWebSocket);
            if (_game_on_game.hasStarted() || _game_on_game.hasMaxClients()) {
                _running_games.push(_game_on_game);
                _game_on_game = _createGameOnGame();
            }
        });
    };

    exports.Game = function (id, minClients, maxClients) {
        var _max_clients = maxClients,
            _min_clients = minClients,
            _id = id,
            _output_handler = null,
            _options = null,
            _local_input_handler = null,
            _world = null,
            _clients = [],
            _is_running = false,
            _has_started = false,

            init = function () {
                // Set up an output handler, default options and create a World
                _output_handler = shared.ServerOutputHandler();
                _options = game.createDefaultOptions();

                // Create an InputHandler that will apply all the commands received by
                // the InputDevice to the player-object
                _local_input_handler = shared.LocalInputHandler();

                _world = world.World(_local_input_handler, _output_handler, _options);
            },

            _hasMaxClients = function () {
                if (_max_clients === null) {
                    throw "cannot check hasMaxClients when no max is set!";
                }

                return _clients.length === _max_clients;
            },

            _createLobbyStatePacket = function () {

            },

            _start = function () {
                console.log("starting game " + _id);
                _is_running = true;
                _has_started = true;
                var player_datas = [];

                _local_input_handler.start();
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
                var start_handler = client.getWebSocket().registerReceivedPacketCallback(shared.PACKET_TYPES.START, null, function (packet) {
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
        };

        init();

        return {
            getNumberOfClients : function () {
                return _clients.length;
            },

            hasMaxClients: _hasMaxClients,

            newConnection: function (id, webSocket) {
                console.log("new connection with id " + id);
                var client = exports.Client(id, webSocket, _local_input_handler),
                    //
                    /**
                     * Listen to HELLOs from the client
                     * @param packet
                     */
                    helloHandler = webSocket.registerReceivedPacketCallback(shared.PACKET_TYPES.HELLO, null, function (packet) {
                        webSocket.unregisterReceivedPacketCallback(helloHandler);
                        client.gotHello(packet.name);

                        // Tell the outputHandler that we have a new client that should receive updates
                        _output_handler.addClient(client.getData());

                        if (_hasMaxClients() && _isAllClientsSetUp()) {
                            _start();
                            return;
                        }

                        if (_min_clients !== null) {
                            _listenForStart(client);
                        }
                    });

                _clients.push(client);
            },

            restart: _restart,

            isRunning : function () {
                return _is_running;
            },

            hasStarted : function () {
                return _has_started;
            }
        };
    };

    exports.Client = function (id, webSocket, inputHandler) {
        var _id = id,
            _web_socket = webSocket,
            _hello = false,
            _name = null,
            _got_start = false,
            _input_device = input.WSInputDevice(webSocket, inputHandler.onInputReceived, id),
            _input_handler = inputHandler;

        return {
            getData : function () {
                return {id : _id, name: _name, webSocket: _web_socket };
            },

            getID : function () {
                return _id;
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
                _input_device.start();
                _got_start = false;
            },

            stop : function () {
                //_input_device.stop();
            }
        };
    };
})(typeof exports === 'undefined'? this['server']={}: exports);

var server = require('./server.js');

// Get the server rollin'
var s = server.Server();
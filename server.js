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
                nextGameID += 1;
                return new exports.Game(nextGameID, 1, 2);
            },

            // Create a new WebSocketServer and start listening
            address = {host: config.CONFIG.bind_to_address, port: config.CONFIG.bind_to_port},
            webSocketServer = new WebSocketServer(address),
            nextClientID = 0,
            nextGameID = 0,
            _gameOnGame = _createGameOnGame(),
            _runningGames = [];

        console.log("listening to ", address);

        /**
         * Listen for new connections on webSocketServer and set up listeners for all new clients
         * Also add all new clients to the list "clients" which will be the basis for creating all players
         *
         */
        webSocketServer.on('connection', function (clientWebSocket) {

            // Enhance the websocket with object support
            shared.addWebSocketObjectSupport(clientWebSocket);

            // Increment the nextClientID, that will be used to ID the next client
            // TODO: Not thread safe?
            nextClientID += 1;

            _gameOnGame.newConnection(nextClientID, clientWebSocket);
            if (_gameOnGame.hasStarted() || _gameOnGame.hasMaxClients()) {
                _runningGames.push(_gameOnGame);
                _gameOnGame = _createGameOnGame();
            }
        });
    };

    exports.Game = function (id, minClients, maxClients) {
        var _maxClients = maxClients,
            _minClients = minClients,
            _id = id,
            _outputHandler = null,
            _options = null,
            _localInputHandler = null,
            _world = null,
            _clients = [],
            _isRunning = false,
            _hasStarted = false,

            init = function () {
                // Set up an output handler, default options and create a World
                _outputHandler = shared.ServerOutputHandler();
                _options = game.createDefaultOptions();

                // Create an InputHandler that will apply all the commands received by
                // the InputDevice to the player-object
                _localInputHandler = shared.LocalInputHandler();

                _world = world.World(_localInputHandler, _outputHandler, _options);
            },

            _hasMaxClients = function () {
                if (_maxClients === null) {
                    throw "cannot check hasMaxClients when no max is set!";
                }

                return _clients.length === _maxClients;
            },

            _start = function () {
                console.log("starting game " + _id)
                _isRunning = true;
                _hasStarted = true;
                var playerDatas = [];

                _localInputHandler.start();
                _.each(_clients, function (client) {
                    // Set up the client_data with the InputDevice and InputHandler and
                    client.start();

                    // Gather all player_data objects and pass them to the world!
                    //var player_infos = [];
                    playerDatas.push(client.getData());
                });

                /**
                * Start the game, supplying it with data our player_datas.
                * Define a _restartCallback for the world to execute when the game ends that
                * will set all clients to .start = false and set gameRunning to false.
                */
                _world.startGame(playerDatas, function () {
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
                var startHandler = client.getWebSocket().registerReceivedPacketCallback(shared.PACKET_TYPES.START, null, function (packet) {
                    client.getWebSocket().unregisterReceivedPacketCallback(startHandler);
                    client.gotStart();
                    if(_clients.length >= _minClients && _getNumberOfClientsReady() === _clients.length ) {
                        _start();
                    }
                });
            },

            _restart = function () {
            _isRunning = false;
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
                var client = exports.Client(id, webSocket, _localInputHandler),
                    /**
                     * Listen to HELLOs from the client
                     * @param packet
                     */
                    helloHandler = webSocket.registerReceivedPacketCallback(shared.PACKET_TYPES.HELLO, null, function (packet) {
                        webSocket.unregisterReceivedPacketCallback(helloHandler);
                        client.gotHello(packet.name);

                        // Tell the outputHandler that we have a new client that should receive updates
                        _outputHandler.addClient(client.getData());

                        if (_hasMaxClients() && _isAllClientsSetUp()) {
                            _start();
                            return;
                        }

                        if (_minClients !== null) {
                            _listenForStart(client);
                        }
                    });

                _clients.push(client);
            },

            restart: _restart,

            isRunning : function () {
                return _isRunning;
            },

            hasStarted : function () {
                return _hasStarted;
            }
        };
    };

    exports.Client = function (id, webSocket, inputHandler) {
        var _id = id,
            _webSocket = webSocket,
            _hello = false,
            _name = null,
            _gotStart = false,
            _inputDevice = input.WSInputDevice(webSocket, inputHandler.onInputReceived, id),
            _inputHandler = inputHandler;

        return {
            getData : function () {
                return {id : _id, name: _name, webSocket: _webSocket };
            },

            getID : function () {
                return _id;
            },

            getWebSocket: function () {
                return _webSocket;
            },

            gotHello: function (name) {
                _hello = true;
                _name = name;
            },

            gotStart: function () {
                _gotStart = true;
            },

            isSetUp: function () {
                return _hello;
            },

            isReady: function () {
                return _gotStart;
            },

            start : function () {
                _inputDevice.start();
                _gotStart = false;
            },

            stop : function () {
                //_inputDevice.stop();
            }
        };
    };
})(typeof exports === 'undefined'? this['server']={}: exports);

var server = require('./server.js');

// Get the server rollin'
var s = server.Server();
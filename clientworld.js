var input = require("./input.js");
var renderer = require("./renderer.js");
var shared = require("./shared.js");

var ClientWorld = function (webSocket, keys) {
    var COMMANDS = {
        LEFT_DOWN : 'LEFT_DOWN',
        RIGHT_DOWN : 'RIGHT_DOWN',
        LEFT_RIGHT_UP : 'LEFT_RIGHT_UP'
    };
    var LINE_SIZE = 3;
    var DESIRED_TPS = 20; // The desired number of ticks per second

    var _gameStarted = false;
    var _players = [];
    var _renderingEngine = null;
    var _desiredTickInterval = 1000 / DESIRED_TPS; // The desired interval between ticks
    var _tickStartTime = 0; // The absolute time when the last tick was started
    var _tickInterval = _desiredTickInterval; // The current interval between ticks
    var _numberOfTicks = 0;
    var _logger = console.log;
    var _logData = "";
    var _tps_text = ""; // The text "Ticks per second" text drawn by the renderingEngine

    // Exposed by public function getTicksPerSecondText()
    var rendering_settings = {
        LINE_SIZE : LINE_SIZE
    };



    /**
     * Make sure that no one logs to the
     * @param message
     */
    var log = function (message, user) {
        if (LOGGING_FILTER == undefined || LOGGING_FILTER.indexOf(user) >= 0) {
            _logData = message + '<br/>' + _logData;
            if (_renderingEngine.isStub()) {
                console.log(message);
            }
        }
    };

    var _log = function (message) {
        log(message, 'playerHandler');
    };

    /**
     * Add a player to the game. It's only allowed to add a player before the game has started
     * @param player The player to add to the game
     */
    var _addPlayer = function (player_data) {
        var player_settings = {
            COMMANDS : COMMANDS,
            LINE_SIZE : LINE_SIZE
        };

        if (!_gameStarted) {
            var player = new ClientPlayer(player_data.id, player_data.name, null, webSocket);
            if (player_data.you) {
                var input_device = new input.LocalInputDevice(player, keys);
            }
            _players.push(player);
            input_device.start();
        }
    };

    var _tick = function () {
        var playerInputStates = [];
        var player;
        var i;
        var deltaTime = _tickInterval / 1000;

        for (i = 0; i < _players.length; i++) {
            player = _players[i];
            playerInputStates.push(player.getInputState());
        }

        for (i = 0; i < _players.length; i++) {
            player = _players[i];
            player.simulate(deltaTime, playerInputStates[i]);
        }

        var collisions = [];
        for (i = 0; i < _players.length; i++) {
            player = _players[i];
            //console.log("player number", i);
            var collission_distance = player.getCollision(deltaTime, _players);
            if (collission_distance) {
                collisions.push({'player': player, 'collision_distance': collission_distance, 'player_number' : i});
            }
        }

        collisions.sort(function (left, right) {
            return left.collision_distance - right.collision_distance;
        });

        for (i = 0; i < collisions.length; i++) {
            player = collisions[i].player;
            player.kill();

            //console.log("removing player " + _players[collisions[i].player_number].getName());
            console.log("removing player " + collisions[i].player_number);
            _players.splice(collisions[i].player_number, 1);
        }
    };

    var onTickReceived = function (packet) {
        for (var i = 0; i < _players.length; i++) {
            var player = _players[i];
            if (packet.players[player.id]) {
                player.addTrailPoint(packet.players[player.id]);
            }
        }
    };

    var startGame = function (players, ws) {
        //ws.onobject = onObject;
        ws.registerReceivedPacketCallback(shared.PACKET_TYPES.TICK, function (packet) { return packet }, onTickReceived);

        _renderingEngine = renderer.CanvasRenderer("canvas", null, null, rendering_settings, this);

        if (_gameStarted) {
            return;
        }
        console.log("starting game");
        for (i = 0; i < players.length; i++) {
            _addPlayer(players[i]);
        }


        var i;
        var self = this;

        for (i = 0; i < _players.length; i++) {
            var player = _players[i];
            // Make sure that all players are in the game
            //_log("Creating new player " + _players[i].getName() + " at x=" + _players[i].getX() + ", y=" + _players[i].getY());
            _renderingEngine.create(player);
        }

        _renderingEngine.start();

        _gameStarted = true;
    };

    var clear = function() {
        _renderingEngine.clear();
        _currentplayerIndex = 0;
        _numberOfTicks = 0;
        _players = [];
    };

    var getTicksPerSecondText = function () {
        // Expose a text describing the ticks per second for rendering by rendering engine
        return _tps_text;
    };

    var getTickDurationRatio = function () {
        // Return the ratio (0 > r > 1) of the tick duration
        // Representing how big part of the tick that has elapsed
        // If a tick is 20 ms long and 10 ms has elapsed since the start of the tick,
        // the number 0.5 will be returned since we are half-way through the tick

        var ratio = (new Date().getTime() - _tickStartTime) / _tickInterval;
        if (ratio > 1) {
            ratio = 1;
        }
        return ratio;
    };


    var getLogData = function () {
        return _logData;
    };

    return {
        clear : clear,
        startGame : startGame,
        log : log,
        getTicksPerSecondText:getTicksPerSecondText,
        getTickDurationRatio:getTickDurationRatio,
        getLogData:getLogData
    };

};
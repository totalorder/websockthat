var renderer = require('./renderer.js');
var player = require('./player.js');
var shared = require('./shared.js');
var input = require('./input.js');

(function(exports){
    exports.World = function (outputHandler) {
        var DESIRED_TPS = 20; // The desired number of ticks per second
        var MAX_TICKS = 350;
        var STUB = true;

        var TURNING_SPEED = 10;
        var MOVEMENT_SPEED = 10;
        var LINE_SIZE = 3;

        var MAX_MOVEMENT_SPEED = LINE_SIZE;
        DESIRED_TPS = (MOVEMENT_SPEED / LINE_SIZE) * MOVEMENT_SPEED;
        MOVEMENT_SPEED = LINE_SIZE;

        var _gameStarted = false;
        var _lastAlive;
        var _players = [];
        //var _player_datas = [];
        var _functionCount = 0;
        var _currentplayerIndex = 0;
        var _renderingEngine = null;
        var _desiredTickInterval = 1000 / DESIRED_TPS; // The desired interval between ticks
        var _tickStartTime = 0; // The absolute time when the last tick was started
        var _tickInterval = _desiredTickInterval; // The current interval between ticks
        var _numberOfTicks = 0;
        var _logger = console.log;
        var _logData = "";
        var _tps_text = ""; // The text "Ticks per second" text drawn by the renderingEngine
        MOVEMENT_SPEED = MOVEMENT_SPEED * DESIRED_TPS;
        TURNING_SPEED = TURNING_SPEED * DESIRED_TPS;

        var LOGGING_FILTER = undefined;

        // Exposed by public function getTicksPerSecondText()

        var rendering_settings = {
            LINE_SIZE : LINE_SIZE
        };

        if (DESIRED_TPS == 0) {
            DESIRED_TPS = 1000;
            _desiredTickInterval = 1000 / DESIRED_TPS;
            _renderingEngine = new renderer.StubRenderer("canvas", null, null, rendering_settings);
        } else if (STUB) {
            _renderingEngine = new renderer.StubRenderer("canvas", null, null, rendering_settings);
        } else {
            _renderingEngine = new renderer.CanvasRenderer("canvas", null, null, rendering_settings);
        }

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

        var addPlayer = function (player_data) {
            _player_datas.push(player_data);
        };

        /**
         * Add a player to the game. It's only allowed to add a player before the game has started
         * @param player The player to add to the game
         */
        var _createPlayer = function (player_data) {
            var player_settings = {
                TURNING_SPEED : TURNING_SPEED,
                LINE_SIZE : LINE_SIZE,
                MOVEMENT_SPEED : MOVEMENT_SPEED
            };

            if (!_gameStarted) {
                var new_player = new player.Player(player_data.id, player_data.name, player_data.input, player_settings);
                _players.push(new_player);
                return new_player;
            }
            return null;
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

            outputHandler.newTick(_numberOfTicks);

            for (i = 0; i < _players.length; i++) {
                player = _players[i];
                player.simulate(deltaTime, playerInputStates[i], outputHandler);
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

            _numberOfTicks++;
        };

        var startGame = function (_player_datas, _restartCallback) {
            if (_gameStarted) {
                return;
            }
            console.log("starting game");
            /*for (i = 0; i < players.length; i++) {
                _addPlayer(players[i]);
            }*/

            var i;
            var self = this;

            for (i = 0; i < _player_datas.length; i++) {
                var new_player = _createPlayer(_player_datas[i]);
                new_player.start();
                // Make sure that all players are in the game
                _log("Creating new player " + new_player.getName());
                _renderingEngine.create(new_player);
            }

            for (i = 0; i < _players.length; i++) {
                var new_player = _players[i];
                new_player.start();
                // Make sure that all players are in the game
                _log("Creating new player " + new_player.getName());
                _renderingEngine.create(new_player);
            }

            _renderingEngine.start();

            _gameStarted = true;

            (function tick() {
                // Runs the game simulation at a given ticks per second, slowing down if rendering or simulation is too slow
                // Will run until end of game
                var i;
                var message;
                var _tickComputationStartTime = new Date().getTime();
                if (!_tick.call(self)) {

                    // Measure the time of the computation and adjust the tick interval if it or the rendering time
                    // is slower than the desired interval
                    var frameRenderTimeBoundary = _renderingEngine.getFrameRenderTime() * 1.5;
                    var _tickComputationTimeBondary = (new Date().getTime() - _tickComputationStartTime) * 1.5;
                    if(_tickComputationTimeBondary > _desiredTickInterval || frameRenderTimeBoundary > _desiredTickInterval){
                        if (_tickComputationTimeBondary > _desiredTickInterval) {
                            _tickInterval = _tickComputationTimeBondary;
                            _tps_text = (1000 / _tickInterval) + " (over desired tick computation boundary)";
                        }

                        if(frameRenderTimeBoundary > _tickInterval) {
                            _tickInterval = frameRenderTimeBoundary;
                            _tps_text = (1000 / _tickInterval) + " (over desired render boundary)";
                        }
                    } else {
                        _tickInterval = _desiredTickInterval;
                        _tps_text = (1000 / _tickInterval);
                    }

                    // Schedule the next tick
                    setTimeout(tick, _tickInterval);
                    _tickStartTime = new Date().getTime();
                }
                else {
                    if (_numberOfTicks >= MAX_TICKS) {
                        message = "No winner! Time out!\n";
                    } else  {
                        message = "Winner is " + _players[_lastAlive].getName() + "\n\nKills\n";
                    }

                    var results = {'winner' : _players[_lastAlive].getName(), 'scores' : {}};
                    for ( i = 0; i < _players.length; i++ ) {
                        message += _players[i].getName() + ": " + _players[i].getKillCount() + "\n";
                        results[_players[i].getName()] = _players[i].getKillCount();
                    }
                    _log(message);
                    alert(message);
                    _gameStarted = false;
                    if(_restartCallback) {
                        _restartCallback(results);
                    }
                }
            })();
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
})(typeof exports === 'undefined'? this['world']={}: exports);
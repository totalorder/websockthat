var renderer = require('./renderer.js');
var player = require('./player.js');
var shared = require('./shared.js');
var input = require('./input.js');

(function(exports){
    exports.World = function (inputHandler, outputHandler, options) {
        console.log("creating the world!");
        var TURNING_SPEED = options.TURNING_SPEED;
        var MOVEMENT_SPEED = options.MOVEMENT_SPEED;
        var LINE_SIZE = options.LINE_SIZE;

        var DESIRED_TPS = (MOVEMENT_SPEED / LINE_SIZE) * MOVEMENT_SPEED;
        MOVEMENT_SPEED = LINE_SIZE;

        var _gameStarted = false;
        var _lastAlive;
        var _players = [];
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
            LINE_SIZE : LINE_SIZE,
            GAME_WIDTH : options.GAME_WIDTH,
            GAME_HEIGHT : options.GAME_HEIGHT
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
        var _createPlayer = function (player_data) {
            var player_settings = {
                TURNING_SPEED : TURNING_SPEED,
                LINE_SIZE : LINE_SIZE,
                MOVEMENT_SPEED : MOVEMENT_SPEED,
                GAME_WIDTH : options.GAME_WIDTH,
                GAME_HEIGHT : options.GAME_HEIGHT
            };

            if (!_gameStarted) {
                var new_player = new player.Player(player_data.id, player_data.name, player_data.input_device, player_data.input_handler, player_settings, player_data.x, player_data.y);
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
                if (collission_distance != null) {
                    collisions.push({'player': player, 'collision_distance': collission_distance, 'player_number' : i});
                }
            }

            collisions.sort(function (left, right) {
                return left.collision_distance - right.collision_distance;
            });

            for (i = 0; i < collisions.length; i++) {
                player = collisions[i].player;
                player.kill();
                var players_alive = 0;
                for (var it = 0; it < _players.length; it++) {
                    if (_players[it].isAlive()) {
                        players_alive ++;
                        _lastAlive = player;
                    }
                }

                console.log("removing player " + collisions[i].player_number);
                _players.splice(collisions[i].player_number, 1);

                if (players_alive <= 1) {
                    outputHandler.newTick(_numberOfTicks + 1);
                    return true;
                }
            }

            _numberOfTicks++;
        };

        var clear = function() {
            if(_renderingEngine) {
                _renderingEngine.clear();
            }
            _numberOfTicks = 0;
            _players = [];
        };

        var startGame = function (_player_datas, _restartCallback) {
            if (_gameStarted) {
                return;
            }
            console.log("starting game");
            var i;
            var self = this;

            clear();

            var player_infos = [];
            for (i = 0; i < _player_datas.length; i++) {
                var player_data = _player_datas[i];
                if (outputHandler) {
                        player_data.x = options.GAME_WIDTH * 0.1 + Math.random() * options.GAME_WIDTH * 0.8;
                        player_data.y = options.GAME_HEIGHT * 0.1 + Math.random() * options.GAME_HEIGHT * 0.8;
                }
                var player_info = {id: player_data.id, name : player_data.name, x: player_data.x, y : player_data.y };
                player_infos.push(player_info);
            }

            if (outputHandler) {
                console.log("got START from all players, sending players: ", player_infos);
                outputHandler.startGame(options, player_infos);

                if(!_renderingEngine) {
                    _renderingEngine = new renderer.StubRenderer("canvas", rendering_settings, this);
                }
            } else {
                if(!_renderingEngine) {
                    _renderingEngine = new renderer.CanvasRenderer("canvas", rendering_settings, this);
                }
            }

            for (i = 0; i < _player_datas.length; i++) {
                var new_player = _createPlayer(_player_datas[i]);
                new_player.start();
                // Make sure that all players are in the game
                _renderingEngine.create(new_player);
            }

            _renderingEngine.start();
            _gameStarted = true;
            if (outputHandler) {

                console.log("starting server");
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
                    } else {
                        message = "Winner is " + _lastAlive.getName();
                        console.log(message);
                        _gameStarted = false;
                        if (outputHandler) {
                            outputHandler.gameOver();
                        }
                        if (inputHandler) {
                            inputHandler.gameOver();
                        }

                        if(_restartCallback) {
                            _restartCallback();
                        }
                    }
                })();
            }
            if (inputHandler) {
                inputHandler.start(_players);
            }
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

        var gameOver = function () {
            _renderingEngine.stop();
        };

        return {
            clear : clear,
            startGame : startGame,
            log : log,
            getTicksPerSecondText:getTicksPerSecondText,
            getTickDurationRatio:getTickDurationRatio,
            getLogData:getLogData,
            gameOver:gameOver
        };

    };
})(typeof exports === 'undefined'? this['world']={}: exports);
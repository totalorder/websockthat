var renderer = require('./renderer.js');
var player = require('./player.js');
var shared = require('./shared.js');
var input = require('./input.js');
var config = require("./config.js"),
    game = require("./" + config.CONFIG.game_package + ".js");

(function(exports){
    exports.World = function (inputHandler, outputHandler, options, render) {
        console.log("creating the world!");

        var simulator = game.getSimulatorClass()(outputHandler, options);

        // Define te game specific settings
        var TURNING_SPEED = options.TURNING_SPEED;
        var MOVEMENT_SPEED = options.MOVEMENT_SPEED;
        var LINE_SIZE = options.LINE_SIZE;

        // Calculate the desired TPS and movement speed based on that we want one tick every LINE_SIZE distance traveled
        var DESIRED_TPS = (MOVEMENT_SPEED / LINE_SIZE) * MOVEMENT_SPEED;
        MOVEMENT_SPEED = LINE_SIZE;

        // Set up internal data structures
        var _gameStarted = false;
        var _lastAlive;
        var _players = [];
        var _renderingEngine = null;
        var _desiredTickInterval = 1000 / DESIRED_TPS; // The desired interval between ticks
        var _tickStartTime = 0; // The absolute time when the last tick was started
        var _tickInterval = _desiredTickInterval; // The current interval between ticks
        var _numberOfTicks = 0;
        var _logger = console.log;
        var _logData = "";
        var _tps_text = ""; // The text "Ticks per second" text drawn by the renderingEngine

        // Recalculate the speeds based on the ticks per second
        // TODO: Why?
        MOVEMENT_SPEED = MOVEMENT_SPEED * DESIRED_TPS;
        TURNING_SPEED = TURNING_SPEED * DESIRED_TPS;

        // Define if we're going to filter the logging
        var LOGGING_FILTER = undefined;

        // Exposed by public function getTicksPerSecondText()

        // Gather settings needed for rendering
        var rendering_settings = {
            LINE_SIZE : LINE_SIZE,
            GAME_WIDTH : options.GAME_WIDTH,
            GAME_HEIGHT : options.GAME_HEIGHT
        };

        /**
         * Log message if it passes any defined LOGGING_FILTER
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

        /**
         * Add a player to the game. It's only allowed to add a player before the game has started
         * @param player_data An object representing the player data
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
                var new_player = simulator.createPlayer(player_data, player_settings);
                _players.push(new_player);
                return new_player;
            }
            return null;
        };

        /**
         * Run one tick of the simulation
         * Gather input from all players, execute the simulation step, look for collissions and kill
         * any collided players
         */
        var _tick = function () {
            var deltaTime = _desiredTickInterval / 1000;
            var result = simulator.simulate(deltaTime);
            _numberOfTicks++;
            outputHandler.tickEnded(_numberOfTicks);
            if (result) {
                return result;
            }

            // Increment the number of ticks to keep track of the ticks we send off to the clients

        };

        /**
         * Reset the world state and rendering engine state, getting ready to start a
         * new game
         */
        var clear = function() {
            if(_renderingEngine) {
                _renderingEngine.clear();
            }
            _numberOfTicks = 0;
            _players = [];
        };

        /**
         * Start ticking and keep doing it until everybody is dead. When everybody is dead _tick() will return true
         * and we shut stuff down
         * Trigger _tick() at the specified interval and try to keep the interval at a good level
         */
        var startTicking = function (_restartCallback) {
            var self = this;

            console.log("starting server");
            (function tick() {
                // Runs the game simulation at a given ticks per second, slowing down if rendering or simulation is too slow
                // Will run until end of game
                var i;
                var message;
                var _tickComputationStartTime = new Date().getTime();

                // Run one tick of the simulation and recalculate tick times if we cannot meet the desired tick rate
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

                // If _tick() returns true, shut everything down
                } else {
                    if (_lastAlive) {
                        message = "Winner is " + _lastAlive.getName();
                        console.log(message);
                    }

                    _gameStarted = false;

                    // Notify everybody interested that its GAME OVER!
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
        };

        /**
         * Create a clean World and set up player objects, rendering engine and start ticking if
         * an outputHandler is specified.
         *
         * @param _player_datas - A list of player_data objects representing each player in the game
         * @param _restartCallback - The callback to notify when the game ends
         */
        var startGame = function (_player_datas, _restartCallback) {
            if (_gameStarted) {
                return;
            }

            console.log("starting game");

            // Set up internal data structures
            var i;
            var player_data = null;

            // Clear the world, cleaning up any data from previous runs. Will call clear on the rendering engine as well
            clear();

            // Generate position data for each player if we're running with an outputHandler. If not, position data
            // should already be present
            if (outputHandler) {
                for (i = 0; i < _player_datas.length; i++) {
                    player_data = _player_datas[i];
                    simulator.setUpPlayerData(player_data);
                }
            }

            // Set up player_info for each player, that will be passed to the outputHandler
            // to be sent off to the clients
            var player_infos = [];
            for (i = 0; i < _player_datas.length; i++) {
                player_data = _player_datas[i];
                var player_info = {id: player_data.id, name : player_data.name, x: player_data.x, y : player_data.y, color: player_data.color };
                player_infos.push(player_info);
            }

            // Trigger a startGame-event on the outputHandler if it's present and set up a rendering engine
            if (outputHandler) {
                console.log("got START from all players, sending players");
                outputHandler.startGame(options, player_infos);
            }

            if(!_renderingEngine) {
                if(render) {
                    //_renderingEngine = new renderer.SVGRenderer("canvas", rendering_settings, this);
                    _renderingEngine = new renderer.CanvasRenderer("canvas", rendering_settings, this, simulator);
                } else {
                    _renderingEngine = new renderer.StubRenderer("canvas", rendering_settings, this, simulator);
                }
            }

            // Create all players, start them, and add them to the rendering engine
            for (i = 0; i < _player_datas.length; i++) {
                var new_player = _createPlayer(_player_datas[i]);
                new_player.start();
                _renderingEngine.create(new_player);
            }

            simulator.start(_players);

            // Start everything!
            _renderingEngine.start();
            _gameStarted = true;
            if (outputHandler) {
                // Start ticking will keep ticking with the simulation until everybody is dead
                startTicking(_restartCallback);
            }
            if (inputHandler) {
                // The input handler will listen to tick-data to feed the simulation
                inputHandler.start(_players, simulator);
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
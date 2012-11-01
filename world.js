var _ = require('underscore')._;

var renderer = require('./renderer.js');
var shared = require('./shared.js');
var input = require('./input.js');
var config = require("./config.js"),
    game = require("./" + config.CONFIG.game_package + ".js");

(function(exports){
    exports.World = function (tick_sender, input_sender, tick_receiver, options, render) {
        console.log("creating the world!");

        var simulator = game.getSimulatorClass()(tick_sender, options),

            // Define te game specific settings
            TURNING_SPEED = options.TURNING_SPEED,
            MOVEMENT_SPEED = options.MOVEMENT_SPEED,
            LINE_SIZE = options.LINE_SIZE,

            // Calculate the desired TPS and movement speed based on that we want one tick every LINE_SIZE distance traveled
            DESIRED_TPS = (MOVEMENT_SPEED / LINE_SIZE) * MOVEMENT_SPEED, // TODO: Document this


            // Set up internal data structures
            _game_started = false,
            _last_alive,
            _players = [],
            _rendering_engine = null,
            _desired_tick_interval = 1000 / DESIRED_TPS, // The desired interval between ticks
            _tick_start_time = 0, // The absolute time when the last tick was started
            _tick_interval = _desired_tick_interval, // The current interval between ticks
            _number_of_ticks = 0,
            _logger = console.log,
            _log_data = "",
            _tps_text = "", // The text "Ticks per second" text drawn by the renderingEngine
            // Define if we're going to filter the logging
            LOGGING_FILTER = null,

            // Gather settings needed for rendering
            rendering_settings = {
                LINE_SIZE : LINE_SIZE,
                GAME_WIDTH : options.GAME_WIDTH,
                GAME_HEIGHT : options.GAME_HEIGHT
            },

            _init = function () {
                // TODO: Why? Document this
                MOVEMENT_SPEED = LINE_SIZE;
                // Recalculate the speeds based on the ticks per second
                MOVEMENT_SPEED = MOVEMENT_SPEED * DESIRED_TPS;
                TURNING_SPEED = TURNING_SPEED * DESIRED_TPS;
            },

            /**
             * Log message if it passes any defined LOGGING_FILTER
             */
            log = function (message, user) {
                if (LOGGING_FILTER === null|| LOGGING_FILTER.indexOf(user) >= 0) {
                    _log_data = message + '<br/>' + _log_data;
                    if (_rendering_engine.isStub()) {
                        console.log(message);
                    }
                }
            },

            /**
             * Add a player to the game. It's only allowed to add a player before the game has started
             * @param player_data An object representing the player data
             */
            _createPlayer = function (player_data) {
                var player_settings = {
                        TURNING_SPEED : TURNING_SPEED,
                        LINE_SIZE : LINE_SIZE,
                        MOVEMENT_SPEED : MOVEMENT_SPEED,
                        GAME_WIDTH : options.GAME_WIDTH,
                        GAME_HEIGHT : options.GAME_HEIGHT
                    },
                    new_player;

                if (!_game_started) {
                    new_player = simulator.createPlayer(player_data, player_settings);
                    _players.push(new_player);
                    return new_player;
                }
                return null;
            },

            /**
             * Run one tick of the simulation
             * Gather input from all players, execute the simulation step, look for collisions and kill
             * any collided players
             */
            _tick = function () {
                var delta_time = _desired_tick_interval / 1000,
                    result = simulator.simulate(delta_time);

                _number_of_ticks += 1;

                tick_sender.tickEnded(_number_of_ticks, _tps_text);
                if (result) {
                    return result;
                }
            },

            /**
             * Reset the world state and rendering engine state, getting ready to start a
             * new game
             */
            clear = function() {
                if(_rendering_engine) {
                    _rendering_engine.clear();
                }
                _number_of_ticks = 0;
                _players = [];
            },

            /**
             * Start ticking and keep doing it until everybody is dead. When everybody is dead _tick() will return true
             * and we shut stuff down
             * Trigger _tick() at the specified interval and try to keep the interval at a good level
             */
            startTicking = function (_restartCallback) {
                var self = this;

                console.log("starting server");
                (function tick() {
                    // Runs the game simulation at a given ticks per second, slowing down if rendering or simulation is too slow
                    // Will run until end of game
                    var message,
                        _tick_computation_start_time = new Date().getTime(),
                        frame_render_time_boundary = null,
                        _tick_computation_time_bondary = null;


                    // Run one tick of the simulation and recalculate tick times if we cannot meet the desired tick rate
                    if (!_tick.call(self)) {

                        // Measure the time of the computation and adjust the tick interval if it or the rendering time
                        // is slower than the desired interval
                        frame_render_time_boundary = _rendering_engine.getFrameRenderTime() * 1.5;
                        _tick_computation_time_bondary = (new Date().getTime() - _tick_computation_start_time) * 1.5;

                        if(_tick_computation_time_bondary > _desired_tick_interval || frame_render_time_boundary > _desired_tick_interval){
                            if (_tick_computation_time_bondary > _desired_tick_interval) {
                                _tick_interval = _tick_computation_time_bondary;
                                _tps_text = (1000 / _tick_interval) + " (over desired tick computation boundary)";
                            }

                            if(frame_render_time_boundary > _tick_interval) {
                                _tick_interval = frame_render_time_boundary;
                                _tps_text = (1000 / _tick_interval) + " (over desired render boundary)";
                            }
                        } else {
                            _tick_interval = _desired_tick_interval;
                            _tps_text = (1000 / _tick_interval);
                        }

                        // Schedule the next tick
                        setTimeout(tick, _tick_interval);
                        _tick_start_time = new Date().getTime();

                    // If _tick() returns true, shut everything down
                    } else {
                        if (_last_alive) {
                            message = "Winner is " + _last_alive.getName();
                            console.log(message);
                        }

                        _game_started = false;

                        // Notify everybody interested that its GAME OVER!
                        if (tick_sender) {
                            tick_sender.gameOver();
                        }
                        if (tick_receiver) {
                            tick_receiver.gameOver();
                        }
                        if(_restartCallback) {
                            _restartCallback();
                        }
                    }
                })();
            },

            /*
             * Create a clean World and set up player objects, rendering engine and start ticking if
             * an tick_sender is specified.
             *
             * @param _player_datas - A list of player_data objects representing each player in the game
             * @param _restartCallback - The callback to notify when the game ends
             */
            startGame = function (_player_datas, _restartCallback) {
                if (_game_started) {
                    return;
                }

                console.log("starting game");

                // Set up internal data structures
                var i,
                    player_data = null,
                    player_infos = [];

                // Clear the world, cleaning up any data from previous runs. Will call clear on the rendering engine as well
                clear();

                // Generate position data for each player if we're running with an tick_sender. If not, position data
                // should already be present
                if (tick_sender) {
                    _.each(_player_datas, function (player_data) {
                        simulator.setUpPlayerData(player_data);
                    });
                }

                // Set up player_info for each player, that will be passed to the tick_sender
                // to be sent off to the client
                _.each(_player_datas, function (player_data) {
                    var player_info = {id: player_data.id, name : player_data.name, x: player_data.x, y : player_data.y, color: player_data.color };
                    player_infos.push(player_info);
                });

                // Trigger a startGame-event on the tick_sender if it's present and set up a rendering engine
                if (tick_sender) {
                    console.log("got START from all players, sending players");
                    tick_sender.startGame(options, player_infos);
                }

                if(!_rendering_engine) {
                    if(render) {
                        //_rendering_engine = new renderer.SVGRenderer("canvas", rendering_settings, this);
                        _rendering_engine = new renderer.CanvasRenderer("canvas", rendering_settings, this, simulator);
                    } else {
                        _rendering_engine = new renderer.StubRenderer("canvas", rendering_settings, this, simulator);
                    }
                }

                // Create all players, start them, and add them to the rendering engine
                _.each(_player_datas, function (player_data) {

                    if (player_data.input_device) {
                        if (input_sender) {
                            player_data.input_device.setOnCommandCallback(input_sender.onInputReceived);
                        } else {
                            player_data.input_device.setOnCommandCallback(simulator.onInputReceived);
                        }
                    }

                    if (player_data.input_receiver) {
                        player_data.input_receiver.setOnCommandCallback(simulator.onInputReceived);
                    }

                    var new_player = _createPlayer(player_data);
                    new_player.start();
                    _rendering_engine.create(new_player);
                });

                simulator.start(_players);

                // Start everything!
                _rendering_engine.start();
                _game_started = true;
                if (tick_sender) {
                    // Start ticking will keep ticking with the simulation until everybody is dead
                    startTicking(_restartCallback);
                }

                if (tick_receiver) {
                    tick_receiver.start(simulator, setTPSText);
                }
            },

            getTicksPerSecondText = function () {
                // Expose a text describing the ticks per second for rendering by rendering engine
                return _tps_text;
            },

            getTickDurationRatio = function () {
                // Return the ratio (0 > r > 1) of the tick duration
                // Representing how big part of the tick that has elapsed
                // If a tick is 20 ms long and 10 ms has elapsed since the start of the tick,
                // the number 0.5 will be returned since we are half-way through the tick

                var ratio = (new Date().getTime() - _tick_start_time) / _tick_interval;
                if (ratio > 1) {
                    ratio = 1;
                }
                return ratio;
            },

            getLogData = function () {
                return _log_data;
            },

            gameOver = function () {
                _rendering_engine.stop();
            },

            setTPSText = function (tps_text) {
                _tps_text = tps_text;
        };

        _init();

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
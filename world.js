/**
 * The game engine Sockworld
 *
 * Exports:
 *  World - Game engine that runs a simulation at a specified ticks per second, orchestrating the network, rendering
 *          game simulation and user input
 *
 */

"use strict";

var _ = require('underscore')._;

var renderer = require('./renderer.js');
var websocktransport = require('./websocktransport.js');
var input = require('./input.js');
var config = require("./config.js"),
    game = require("./" + config.CONFIG.game_package + ".js");

(function(exports){
    /**
     * Networked game engine that hosts a game simulator and exposes it to player input, network events and executes
     * rendering.
     * Relays all player input and simulation output through external input/state sender and receivers making sure
     * the different layers of logic are decoupled.
     *
     * @param tick_sender - An instance of a TickSender that should relay all simulation output to other clients
     *                      If this is present, the World will act as if in Server-mode
     * @param input_sender - An instance of an InputSender that should relay all player input to the server
     *                       If this is present, the World will act as if in Client-mode
     * @param tick_receiver - An instance of a TickReceiver that should accept any incoming tick data from the server
     *                        and relay it to the World
     * @param options - A dictionary of game options that the game should obey
     * @param render - Boolean saying if the simulation should be rendered or not
     */
    exports.World = function (tick_sender, input_sender, tick_receiver, options, render) {
        console.log("creating the world!");

        // Create an instance of the specified game simulator
        var simulator = game.getSimulatorClass()(tick_sender, options),

            // Get the simulators desired Ticks Per Second
            DESIRED_TPS = simulator.getDesiredTPS(),

            _game_started = false,

            // Will hold the winning player when the game ends
            _last_alive,

            // A list of all players in the game. Populated by instances returned by simulator.createPlayer
            _players = [],

            // The current rendering engine
            _rendering_engine = null,

            // The interval in milliseconds that is desired
            _desired_tick_interval = 1000 / DESIRED_TPS, // The desired interval between ticks

            // The absolute time when the last tick was started
            _tick_start_time = 0,

            // The actual interval between ticks
            _tick_interval = _desired_tick_interval,

            // The total number of ticks since last game start
            _number_of_ticks = 0,

            // The logging function to be used
            _logger = console.log,

            // A string containing all log records recorded
            _log_data = "",

            // The text "Ticks per second" text drawn by the renderingEngine
            _tps_text = "",

            // Define if we're going to filter the logging
            LOGGING_FILTER = null,

            // Tell the ticker that we want to force a stop
            _force_stop = false,

            // Gather settings needed for rendering
            rendering_settings = {
                LINE_SIZE : options.LINE_SIZE,
                GAME_WIDTH : options.GAME_WIDTH,
                GAME_HEIGHT : options.GAME_HEIGHT
            },

            /**
             * No initialization work needed at the moment
             */
            _init = function () {
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
             * Create and add a player to the game. It's only allowed to add a player before the game has started
             * @param player_data - An object representing the player data
             */
            _createPlayer = function (player_data) {
                var player_settings = {
                        TURNING_SPEED : options.TURNING_SPEED,
                        LINE_SIZE : options.LINE_SIZE,
                        MOVEMENT_SPEED : options.MOVEMENT_SPEED,
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
             * Notify the tick_sender that the tick has ended so it has a chance to flush the output buffer and send
             * the tick data to the clients
             */
            _tick = function () {
                var delta_time = null,
                    result;

                if (_force_stop) {
                    return true;
                }

                // Calculate the time between now and the last tick. If TPS compensation is not allowed, we will
                // report the desired delta time, making the game slow down instead of making fewer simulation steps
                // Divide by 1000 to get the value in seconds since the intervals are in milliseconds.
                if (options.ALLOW_TPS_COMPENSATION) {
                    delta_time = _tick_interval / 1000.0;
                } else {
                    delta_time = _desired_tick_interval / 1000.0;
                }

                // Execute the actual simulation and store the result
                // If the result is true the game has ended and we notify upstream that we're not live anymore
                result = simulator.simulate(delta_time);

                _number_of_ticks += 1;

                // Notify the tick_sender that the tick has ended so it has a chance to flush the output buffer and send
                // the tick data to the clients
                tick_sender.tickEnded(_number_of_ticks, _tps_text);

                // If the result is true the game has ended and we notify upstream that we're not live anymore
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
             * Trigger _tick() at the specified interval and try to keep the interval at a good level, making the
             * interval longer if we're low on resources
             *
             * @param _restartCallback - The callback to call when the game has ended and we want upstream to know that
             *                           it's safe to restart
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

                        // Notify upstream that it's safe to restart
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

                console.log("starting world");

                // Set up internal data structures
                var player_infos = [];

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
                        _rendering_engine = new renderer.CanvasRenderer("canvas", rendering_settings, this, simulator);
                    } else {
                        _rendering_engine = new renderer.StubRenderer("canvas", rendering_settings, this, simulator);
                    }
                }

                // Create all players, start them, and add them to the rendering engine
                _.each(_player_datas, function (player_data) {

                    // If the player has an InputDevice, direct it to the input_sender if there is one,
                    // else direct it directly to the simulator
                    if (player_data.input_device) {
                        if (input_sender) {
                            player_data.input_device.setOnCommandCallback(input_sender.onInputReceived);
                        } else {
                            player_data.input_device.setOnCommandCallback(simulator.onInputReceived);
                        }
                    }

                    // If the player has an InputReceiver, direct it to simulator.onInputReceived
                    if (player_data.input_receiver) {
                        player_data.input_receiver.setOnCommandCallback(simulator.onInputReceived);
                    }

                    // Create a new player and start it and it's input device if present
                    var new_player = _createPlayer(player_data);
                    new_player.start();

                    // Give the input device the player id for use when barcoding the data sent off
                    if (player_data.input_device) {
                        player_data.input_device.start(player_data.id);
                    }
                    _rendering_engine.create(new_player);
                });

                // Get the simulator ready and let it wait for us to call simulator.simulate()
                simulator.start(_players);

                // Start everything!
                _rendering_engine.start();
                _game_started = true;
                if (tick_sender) {
                    // Start ticking will keep ticking with the simulation until everybody is dead
                    startTicking(_restartCallback);
                }

                // Hook up the tick receiver to the simulator
                if (tick_receiver) {
                    tick_receiver.start(simulator, setTPSText);
                }
            },

            /**
             * Returns the text to be rendered describing the number of ticks per second
             *
             * @returns string - The text to be rendered describing the number of ticks per second
             */
            getTicksPerSecondText = function () {
                // Expose a text describing the ticks per second for rendering by rendering engine
                return _tps_text;
            },

            /**
             * Return the ratio (0 > r > 1) of the tick duration
             * Representing how big part of the tick that has elapsed
             * If a tick is 20 ms long and 10 ms has elapsed since the start of the tick,
             * the number 0.5 will be returned since we are half-way through the tick
             *
             * @returns number - A ratio between 0 and 1 inclusive
             */
            getTickDurationRatio = function () {
                var ratio = (new Date().getTime() - _tick_start_time) / _tick_interval;
                if (ratio > 1) {
                    ratio = 1;
                }
                return ratio;
            },

            /**
             * Return a string containing all log data recorded
             *
             * @returns string
             */
            getLogData = function () {
                return _log_data;
            },

            /**
             * Do house keeping work, shutting of the rendering engine
             */
            gameOver = function () {
                _rendering_engine.stop();
            },

            /**
             * Set the text that should be rendered describing the number of ticks per second
             * Should be called from a TickReceiver
             */
            setTPSText = function (tps_text) {
                _tps_text = tps_text;
            },

            /**
             * Stop the simulation
             */
            stop = function () {
                _force_stop = true;

        };

        _init();

        return {
            clear : clear,
            startGame : startGame,
            log : log,
            getTicksPerSecondText:getTicksPerSecondText,
            getTickDurationRatio:getTickDurationRatio,
            getLogData:getLogData,
            gameOver:gameOver,
            stop:stop
        };

    };
})(typeof exports === 'undefined'? this['world']={}: exports);
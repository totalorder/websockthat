"use strict";
var _ = require('underscore')._;
var renderer = require('./renderer.js');
var websocktransport = require('./websocktransport.js');
var input = require('./input.js');

(function (exports) {
    exports.PongSimulator = function (tick_sender, options) {
        // The desired movement speed in pixels/second. This will affect the result of getDesiredTPS() to achieve it.
        var DESIRED_MOVEMENT_SPEED = 400,
            // Set up internal data structures
            _players = null,
            _players_map = {},
            _ball = {x : options.GAME_WIDTH / 2, y : options.GAME_HEIGHT / 2},
            MOVEMENT_SPEED,
            // The callback to be called with the new scores every time the score changes
            _updateScoresCallback = null,

            /**
             * Populate the lookup table _players_map with the player object with player.id as key, for fast access
             * Should be re-run before every simulation start
             */
            _populatePlayersMap = function () {
                _players_map = {};
                _.each(_players, function (player) {
                    _players_map[player.id] = player;
                });
            },

            /**
             * Externally exposed callback that should be used as callback to InputReceiver.setOnCommandCallback
             * Will apply the input command to the given player
             *
             * @param player_id - The player id associated with the given input_command
             * @param input_command - One of exports.INPUT_COMMANDS
             */
            onInputReceived = function (player_id, input_command) {
                _players_map[player_id].setInternalInputCommand(input_command);
            },

            /**
             * Return a map of all player scores based on ID
             */
            getPlayerScores = function () {
                var player_scores = {};
                _.each(_players, function (player) {
                    player_scores[player.id] = player.getScore();
                });
                return player_scores;
            },

            bounceHorizontal = function () {
                _ball.direction = 360 - _ball.direction;
            },

            bounceVertical = function () {
                _ball.direction = ((360 - _ball.direction) + 180) % 360;
            },

            /**
             * Run one tick of the simulation
             * Gather input from all players, execute the simulation step, look for collisions and kill
             * any collided players
             */
            simulate = function (delta_time) {
                // Set up internal data structures
                var player_input_states = [],
                    game_over = false;
                // This should be dependent on _ticsukInterval if the game doesn't depend on all ticks
                // being equally far apart

                // Sample the input state from all players. This is done at the same time to ensure that all players'
                // input is sampled at the same time since it can change during the simulation-step, keeping
                // the simulation equal and fair to all players
                _.each(_players, function (player) {
                    player_input_states.push(player.getInputState());
                });

                // Run the simulation step for all players, passing along the tick_sender to send off any data generated
                _.each(_players, function (player, index) {
                    player.simulate(delta_time, player_input_states[index], tick_sender);
                });

                _ball.x += Math.sin(_ball.direction * (Math.PI / 180)) * delta_time * MOVEMENT_SPEED;
                _ball.y += Math.cos(_ball.direction * (Math.PI / 180)) * delta_time * MOVEMENT_SPEED;

                tick_sender.getTickPacket().ball = {x: _ball.x, y : _ball.y};

                _.each(_players, function (player) {
                    var collision = player.getCollision();
                    if (collision) {
                        bounceHorizontal();
                    }
                });

                if (_ball.y < options.LINE_SIZE || _ball.y > options.GAME_HEIGHT - options.LINE_SIZE) {
                    bounceVertical();
                }

                if (_ball.x < 0) {
                    _players[1].incrementScore();
                    game_over = true;
                }

                if (_ball.x > options.GAME_WIDTH) {
                    _players[0].incrementScore();
                    game_over = true;
                }

                if (game_over && _updateScoresCallback) {
                    _updateScoresCallback(getPlayerScores());
                }
                return game_over;
            },

            /**
             * Reset the world state and rendering engine state, getting ready to start a
             * new game
             *
             * @param players - A list of AchtungSimulator.Player-objects that should represent all players in the game
             *                  All players should already be set up and ready to start without any initialization
             * @param updateScoresCallback - Callback to be called with the new scores every time the score changes
             */
            start = function (players, updateScoresCallback) {
                MOVEMENT_SPEED = options.MOVEMENT_SPEED / (1 / getDesiredTPS());
                _players = players;
                _updateScoresCallback = updateScoresCallback;
                _ball = {x: options.GAME_WIDTH / 2, y : options.GAME_HEIGHT / 2, direction : Math.random() * 360 };
                if (_test_options) {
                    _ball.direction = 90;
                    _ball.y = options.LINE_SIZE;
                }
                _populatePlayersMap();
            },

            draw = function (ctx) {
                ctx.beginPath();
                ctx.arc(_ball.x, _ball.y, options.LINE_SIZE, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.fill();
            },

            prepareDraw = function (ctx) { return []; },

            /**
             * Externally exposed callback that should be called by TickReceiver.onTickReceived
             * Will apply the tick simulation data to the local simulation
             *
             * @param tick_packet - a communication.PACKET_TYPES.TICK-packet
             */
            receiveExternalUpdate = function (tick_packet) {
                _.each(_players, function (player) {
                    if (tick_packet.players[player.id]) {
                        player.receiveExternalUpdate(tick_packet.players[player.id]);
                    }
                });
                _ball.x = tick_packet.ball.x;
                _ball.y = tick_packet.ball.y;
            },

            /**
             * Return the number of of ticks per second that the game wants to run in
             * The option parameter ALLOW_TPS_COMPENSATION will tell the World-engine if
             * it is allowed to lower the TPS if resources are low, and still keep the game speed.
             * Setting it to false will ensure the simulation will always receive a set delta_time for each tick,
             * making the game slow down when low on resources
             *
             * @returns number
             */
            getDesiredTPS = function () {
                // Calculate the desired TPS based on that we want one tick every LINE_SIZE distance traveled
                // This is to make sure our naive collision detection is can count on that there is at least
                // one trail point every LINE_SIZE-pixel, making it impossible to slip between trail points.
                // This assumes createDefaultOptions uses a MOVEMENT_SPEED that is equal to LINE_SIZE
                return DESIRED_MOVEMENT_SPEED / options.LINE_SIZE;
            },

            setUpPlayerData = function (player_data, set_up_player_datas) {
                if (set_up_player_datas.length === 0) {
                    player_data.x = 10;
                } else {
                    player_data.x = options.GAME_WIDTH - 10;
                }

                player_data.y = options.GAME_HEIGHT * 0.1 + Math.random() * options.GAME_HEIGHT * 0.8;
                if (_test_options) {
                    player_data.y = options.GAME_HEIGHT - 5;
                }
            },

            Player = function (id, name, input_device, input_handler, settings, x, y, direction, color) {
                var _x = x,
                    _y = y,
                    // The score for this player during the match
                    _score = 0,
                    _last_command = exports.INPUT_COMMANDS.UP_DOWN_UP,
                    alive = true,
                    getInputState = function () {
                        return _last_command;
                    },

                    simulate = function (delta_time, input_state, tick_sender) {
                        if (input_state === exports.INPUT_COMMANDS.UP_DOWN) {
                            if (_y > options.PADDLE_HEIGHT / 2) {
                                _y -= MOVEMENT_SPEED * delta_time;
                            }
                        } else if (input_state === exports.INPUT_COMMANDS.DOWN_DOWN) {
                            if (_y < options.GAME_HEIGHT - options.PADDLE_HEIGHT / 2) {
                                _y += MOVEMENT_SPEED * delta_time;
                            }
                        }

                        /*var player_tick_data = outputHandler.getTickPacketPlayerData(id);
                        player_tick_data.paddle_position = _y;*/
                        tick_sender.setPlayerData(id, {'paddle_position': _y});
                    },

                    getCollision = function () {
                        return _ball.x > _x - options.LINE_SIZE &&
                                _ball.x < _x + options.LINE_SIZE &&
                                _ball.y > _y - options.PADDLE_HEIGHT / 2 &&
                                _ball.y < _y + options.PADDLE_HEIGHT / 2;
                    },

                    receiveExternalUpdate = function (data) {
                        _y = data.paddle_position;
                    },

                    prepareDraw = function (ctx) {
                        ctx.clearRect(0, 0, settings.GAME_WIDTH, settings.GAME_HEIGHT);
                        return [];
                    },

                    kill = function () {
                        alive = false;
                        console.log("Player " + id + " " +  name + " died!");
                    },

                    getName = function () {
                        return name;
                    },

                    isAlive = function () {
                        return alive;
                    },

                    /**
                     * Increment the player score by one
                     */
                    incrementScore = function () {
                        _score += 1;
                    },

                    /**
                     * Get the current score
                     */
                    getScore = function () {
                        return _score;
                    },

                    /**
                     * Sets command as the last input command. Called from PongSimulator.onInputReceived when
                     * input is received from the outside world
                     *
                     * @param command - One of exports.INPUT_COMMANDS
                     */
                    setInternalInputCommand = function (command) {
                        _last_command = command;
                    },

                    start = function () {
                        if (input_device) {
                            input_device.start(id);
                        }

                        if (input_handler) {
                            input_handler.start(this, setInternalInputCommand);
                        }

                    },

                    draw = function (ctx, redraw_areas) {
                        ctx.fillRect(_x - options.LINE_SIZE / 2, _y - options.PADDLE_HEIGHT / 2,
                                     options.LINE_SIZE, options.PADDLE_HEIGHT);
                    };

                return {
                    simulate: simulate,
                    draw: draw,
                    prepareDraw: prepareDraw,
                    getInputState: getInputState,
                    getCollision: getCollision,
                    kill: kill,
                    getName: getName,
                    start : start,
                    id : id,
                    color : color,
                    isAlive : isAlive,
                    setInternalInputCommand : setInternalInputCommand,
                    receiveExternalUpdate : receiveExternalUpdate,
                    incrementScore : incrementScore,
                    getScore : getScore
                };
            },

            createPlayer = function (player_data, player_settings) {
                return new Player(player_data.id, player_data.name, player_data.input_device, player_data.input_handler,
                    player_settings, player_data.x, player_data.y, player_data.direction, player_data.color);
            };

        return {
            simulate : simulate,
            receiveExternalUpdate : receiveExternalUpdate,
            prepareDraw: prepareDraw,
            draw : draw,
            start : start,
            setUpPlayerData : setUpPlayerData,
            createPlayer : createPlayer,
            onInputReceived : onInputReceived,
            getDesiredTPS : getDesiredTPS
        };
    };

    exports.createDefaultOptions = function () {
        var LINE_SIZE = 12,
            options = {
                // The desired number of ticks per second
                ALLOW_TPS_COMPENSATION : false,
                TURNING_SPEED : 10,
                MOVEMENT_SPEED : LINE_SIZE,
                LINE_SIZE : 12,
                GAME_WIDTH : 600,
                GAME_HEIGHT : 600,
                PADDLE_HEIGHT : 90
            };

        if (_test_options) {
            options.GAME_WIDTH = 40;
            options.GAME_HEIGHT = 60;
            options.PADDLE_HEIGHT = 5;
        }
        return options;
    };

    // The defined input commands that can be triggered
    exports.INPUT_COMMANDS = {
        UP_DOWN : 'UP_DOWN',
        DOWN_DOWN : 'DOWN_DOWN',
        UP_DOWN_UP : 'UP_DOWN_UP',
        START : 'START'
    };

    exports.getSimulatorClass = function () {
        return exports.PongSimulator;
    };

    var _test_options = false;
    exports.setTestOptions = function (test_options) {
        _test_options = test_options;
    };

})(typeof exports === 'undefined'? this['pong']={}: exports);
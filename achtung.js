/**
 * Game module for the game Achtung,
 * Implements the GameModule-interface
 *
 * Exports:
 *  AchtungSimulator: Game engine that implements the Simulator-interface
 *  createDefaultOptions: Returns the default options for the Game-module
 *  getSimulatorClass: Returns the AchtungSimulator
 */

"use strict";
var _ = require('underscore')._;

var renderer = require('./renderer.js');
var websocktransport = require('./websocktransport.js');
var input = require('./input.js');

(function(exports){
    /**
     * Simulator for the game Achtung
     * Implements the Simulator-interface
     *
     * Can either act as a server, running all simulation steps and sending simulation results through tick_sender,
     * or act as a client, receiving simulation data from the outside, through receiveExternalUpdate.
     * As a server, incoming input commands will be received through onInputReceived.
     * As a client, the simulator will not know about input from the local player, since the input device should
     * be configured to send all inputs to the server.
     *
     * @param tick_sender - An instance of a TickSender that should receive any outgoing simulation results
     * @param options - the (maybe modified) result of achtung.createDefaultOptions()
     */
    exports.AchtungSimulator = function (tick_sender, options) {

        // The desired movement speed in pixels/second. This will affect the result of getDesiredTPS() to achieve it.
        var DESIRED_MOVEMENT_SPEED = 100,
            // Will hold last player to be alive when the game ends - the winner of the round
            _last_alive,

            // The callback to be called with the new scores every time the score changes
            _updateScoresCallback = null,

            // A list of all players in the simulation
            _players = null,

            // A list of all players in the simulation that are still alive and should participate in the simulation
            _alive_players = null,

            // A lookup table for fast access to the players by ID for use when receiving input
            _players_map = {},

            /**
             * Populate the lookup table _players_map with the player object with player.id as key, for fast access
             * Should be re-run before every simulation start
             */
            _populatePlayersMap = function () {
                _players_map = {};
                _.each(_alive_players, function (player) {
                    _players_map[player.id] = player;
                });
            },

            /**
             * Externally exposed callback that should be used as callback to InputReceiver.setOnCommandCallback
             * Will apply the input command to the given player
             *
             * @param player_id - The player id associated with the given input_command
             * @param input_command - One of input.COMMANDS
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

            /**
             * Run one tick of the simulation
             * Gather input from all players, execute the simulation step, look for collisions and kill
             * any collided players
             */
            simulate = function (delta_time) {
                // Since the naive collision detection requires that there is at least one trail point every LINE_SIZE-pixel
                // to make it impossible to slip between trail points - we make sure we advance by one "speed step" every
                // tick instead of by the time between the ticks
                // This results in the TPS controlling the game speed, instead of just increasing the number of simulation
                // steps per second.
                delta_time *= getDesiredTPS();

                // A list of the input states that will be read from each player to be fed into the simulation for each
                // player
                var player_input_states = [],

                    // A list of any collisions, associated with their players and the distance between the colliding bodies
                    collisions = [],
                    game_over = false;

                // Sample the input state from all players. This is done at the same time to ensure that all players'
                // input is sampled at the same time since it can change during the simulation-step, keeping
                // the simulation equal and fair to all players
                _.each(_alive_players, function (player) {
                    player_input_states.push(player.getInputState());
                });

                // Run the simulation step for all players, passing along the tick_sender to send off any data generated
                _.each(_alive_players, function (player, index) {
                    player.simulate(delta_time, player_input_states[index], tick_sender);
                });

                // Check for collisions for all players and how close to the impact spot they are
                // They are then sorted and killed in the order of closest to impact spot
                // This is not a totally fair comparison in all cases, but it's good enough.
                _.each(_alive_players, function (player, index) {
                    // Be sure to send in ALL players, not just the alive ones, when checking for collisions
                    var collision_distance = player.getCollision(delta_time, _players);
                    if (collision_distance !== null) {
                        collisions.push({player: player, collision_distance: collision_distance, player_number : index});
                    }
                });

                // Sort our collisions in the order of closest to impact spot
                collisions.sort(function (left, right) {
                    return left.collision_distance - right.collision_distance;
                });

                // Kill off players in the order of closest to impact spot
                // End the simulation if there is only one player alive, making hen the winner
                _.each(collisions, function (collision) {
                    var player = collision.player,
                        players_alive = 0;
                    player.kill();

                    // Check if any one is still alive
                    _.each(_alive_players, function (player) {
                        if (player.isAlive()) {
                            players_alive += 1;
                            _last_alive = player;
                        }
                    });

                    console.log("removing player " + collision.player_number);
                    // Remove the player from the simulation
                    _alive_players.splice(collision.player_number, 1);

                    // Increment the score of all alive players when someone dies
                    _.each(_alive_players, function (player) {
                        player.incrementScore();
                    });

                    // End the simulation of one or less players are alive - GAME OVER
                    if (players_alive <= 1) {
                        game_over = true;
                    }
                });

                // Notify the world that the scores have changed if there were any collisions
                if (_updateScoresCallback && collisions.length > 0) {
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
            start = function(players, updateScoresCallback) {
                _players = players;
                _updateScoresCallback = updateScoresCallback;
                _alive_players = [];
                _.each(_players, function (player) {
                    _alive_players.push(player);
                });
                _populatePlayersMap();
            },

            /**
             * Do setup work for a player before it's instantiated.
             * Calculate a random position within further than 30% of the mapsize from any map-edge,
             * and randomize a direction between 0 and 360 degrees. Make sure the random location is at least
             * 50 * MOVEMENT_SPEED units away from any other spawn point.
             * if player_data.test_client is set, we're running a test and applying start positions that will
             * end the game quickly
             *
             * @param player_data - An instance of a player_data-object, that will be passed to createPlayer()
             * @param set_up_player_datas - player_data for players who have already been set up
             */
            setUpPlayerData = function (player_data, set_up_player_datas) {
                var _max_tries = 5, try_again;

                // Try 5 times to randomize a position 30 * MOVEMENT_SPEED units away from any other player spawn point
                while (true) {
                    try_again = false;

                    // Randomize a spawn point further than 30% of the mapsize from any map-edge.
                    player_data.x = options.GAME_WIDTH * 0.3 + Math.random() * options.GAME_WIDTH * 0.7;
                    player_data.y = options.GAME_HEIGHT * 0.3 + Math.random() * options.GAME_HEIGHT * 0.7;
                    _max_tries--;

                    if (_max_tries == 0) {
                        break;
                    }

                    // Check if we're too close to any other player and set try_again if we are
                    _.each(set_up_player_datas, function (set_up_player_data) {

                        if(Math.sqrt(Math.pow(set_up_player_data.x - player_data.x,2) +
                            Math.pow(set_up_player_data.y - player_data.y,2)) < options.MOVEMENT_SPEED * 50){
                            try_again = true;
                            return true; // Simulate a "break"
                        }
                        console.log(options.MOVEMENT_SPEED * 50, Math.sqrt(Math.pow(set_up_player_data.x - player_data.x,2) +
                            Math.pow(set_up_player_data.y - player_data.y,2)));
                    });

                    if (!try_again) {
                        break;
                    }
                }
                player_data.direction = Math.random() * 360;

                // Set test positions that will end the game quickly if we're running a test
                if (player_data.test_client) {
                    player_data.x = options.MOVEMENT_SPEED * 4;
                    player_data.y = options.MOVEMENT_SPEED * 4 * (1 + player_data.test_client / 2);
                    player_data.direction = 180;
                }
            },

            /**
             * Create and return a new Player-object based on a player_data object and a player_settings dictionary
             * @param player_data - A player_data object that should contain all structures needed to create a Player
             * @param player_settings - Settings that the player should obey when running the simulation
             */
            createPlayer = function (player_data, player_settings) {
                return new Player(player_data.id, player_data.name, player_settings, player_data.x, player_data.y, player_data.direction, player_data.color);
            },

            /**
             * Do any rendering required for the game itself. Since all rendering is delegated to Player.draw()
             * we don't need to do anything here
             *
             * @param ctx a HTML5-canvas context
             */
            draw = function (ctx) {},

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

            /**
             * A Player within the simulation, that holds all data and logic that's important to run players
             * within the simulation
             *
             * @param id - The external (simulator-unique) ID of the player
             * @param name - The name of the player, reported to opponents
             * @param settings - A settings-dictionary that should be obeyed when running the simulation
             * @param x - The horizontal start position of the player
             * @param y - The vertical start position of the player
             * @param direction - The direction in degrees the player is moving in
             * @param color - The html-color of the player
             */
            Player = function (id, name, settings, x, y, direction, color) {

                // The current horizontal and vertical position of the player
                var _x = x,
                    _y = y,

                    // The score for this player during the match
                    _score = 0,

                    // The size of the current hole. Will be minus if we're not currently creating a hole.
                    _hole_size = 999,

                    // The last inpt command that was received from the user controlling this player
                    _last_command = input.COMMANDS.LEFT_RIGHT_UP,

                    // The current direction in degrees the player is travelling
                    _direction = direction,

                    // The trail of the players worm. A list of points, starting at the start x/y of the player
                    _trail = [{x: _x, y: _y}],

                    // Boolean telling if the player is alive or out of the game
                    alive = true,

                    /**
                     * Returns the current input state of the player
                     *
                     * @returns One of input.COMMANDS
                     */
                    getInputState = function () {
                        return _last_command;
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
                     * Run the simulation step for this player
                     * Turn left, right or not at all, move in that direction and add one point to our trail
                     *
                     * @param delta_time - The time in seconds the last tick took
                     * @param input_state - One of input.COMMANDS
                     * @param tick_sender - A TickSender-instance
                     */
                    simulate = function (delta_time, input_state, tick_sender) {
                        // Turn left or right or not at all depending on the player input
                        if (input_state === input.COMMANDS.LEFT_DOWN) {
                            _direction += settings.TURNING_SPEED * delta_time;
                        } else if (input_state === input.COMMANDS.RIGHT_DOWN) {
                            _direction -= settings.TURNING_SPEED * delta_time;
                        }

                        // Move in our current direction
                        _x += Math.sin(_direction * (Math.PI/180)) * delta_time * settings.MOVEMENT_SPEED;
                        _y += Math.cos(_direction * (Math.PI/180)) * delta_time * settings.MOVEMENT_SPEED;

                        // Increase the measured size of the hole and reset it to a minus value
                        // each time it goes over a threshold
                        _hole_size += settings.MOVEMENT_SPEED * delta_time;
                        if (_hole_size >= 18) {
                            _hole_size = -Math.random() * 280 - 140;
                        }

                        var trail_point = {x: _x, y: _y};
                        // Mark the point as part of a hole if our hole size if zero or more
                        if (_hole_size >= 0) {
                            trail_point.h = true;
                        }

                        _trail.push(trail_point);
                        tick_sender.setPlayerData(id, trail_point);
                    },

                    /**
                     * Called by AchtungSimulator.receiveExternalUpdate when it's been fed with tick data from
                     * TickReceiver.onTickReceived.
                     * Add the trail point to the local simulation
                     *
                     * @param data - Trail point like {x: 1, y: 2}
                     */
                    receiveExternalUpdate = function (data) {
                        addTrailPoint(data);
                    },

                    /**
                     * Draw the current player by looping through all trail points and drawing arcs with the
                     * players color
                     *
                     * @param ctx a HTML5-canvas context
                     */
                    draw = function (ctx) {
                        /**
                         * Utility function that draws a line between two points
                         * Not necessary if the trail points are close enough
                         * @param last_point
                         * @param point
                         */
                        var drawLineBetweenPoints = function (last_point, point) {
                                if(last_point) {
                                    ctx.beginPath();
                                    ctx.moveTo(last_point.x, last_point.y);
                                    ctx.lineTo(point.x, point.y);
                                    ctx.closePath();
                                    ctx.stroke();
                                }
                            },

                            last_point = false;

                        // Draw a filled arc for each trail point in our trail
                        ctx.fillStyle = color;
                        _.each(_trail, function (point) {
                            // To draw lines between the points:
                            // drawLineBetweenPoints(point, last_point);

                            // Only draw a point if it's not a hole
                            if(!point.h) {
                                ctx.beginPath();
                                ctx.arc(point.x, point.y, settings.LINE_SIZE, 0, Math.PI * 2, true);
                                ctx.closePath();
                                ctx.fill();
                            }

                            last_point = point;
                        });

                        // Draw the last point any way since its needed to guide the player during hole construction
                        ctx.beginPath();
                        ctx.arc(last_point.x, last_point.y, settings.LINE_SIZE, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.fill();
                    },

                    /**
                     * Calculate a list of any collisions of the worm head to any other worm parts and return the distance
                     * between the two closest colliding bodies
                     * Also check if the head is outside the game area an return it as a collision if detected
                     *
                     * WARNING: Very naive collision detection that assumes that there is at least one trail point
                     * every LINE_SIZE-pixel, making it impossible to slip between trail points. It loops through
                     * all trail points on the map except the last few from the own player and looks for a
                     * distance < LINE_SIZE between the head and any other point.
                     *
                     * @param delta_time - The time in seconds the last tick took
                     * @param players - The list of all players in the simulation
                     * @returns number - The distance to the collision if any or null of not found
                     */
                    getCollision = function (delta_time, players) {
                        // A list of the distances between any colliding points
                        var collisions = [],

                            // The distance in number of trail parts from the head that will not touch the head if going
                            // in a straight line. Used for skipping the current players last N trail parts in the collision
                            // detection to avoid crashing into ourselves right at the start.
                            _trail_touch_distance = ((settings.LINE_SIZE*2) / (settings.MOVEMENT_SPEED * delta_time)) + 1,
                            that = this;

                        // Check if the player is outside the map
                        if (_x < settings.LINE_SIZE / 2) {
                            return settings.LINE_SIZE / 2 - _x; // Not accurate
                        }
                        if (_x > settings.GAME_WIDTH - settings.LINE_SIZE / 2) {
                            return _x - (settings.GAME_WIDTH - settings.LINE_SIZE / 2);
                        }
                        if (_y < settings.LINE_SIZE / 2) {
                            return settings.LINE_SIZE / 2 - _y; // Not accurate
                        }

                        if (_y > settings.GAME_HEIGHT - settings.LINE_SIZE / 2) {
                            return _y - (settings.GAME_HEIGHT - settings.LINE_SIZE / 2);
                        }

                        _.each(players, function (player) {
                            var trail = player.getTrail(),

                                // The number of trail points to look at when collision detecting before stopping. For
                                // any other player this i trail.length, but for the current player we skip the most
                                // newly created trail points to avoid crashing into ourselves right at the start. See
                                // the docstring for _trail_touch_distance
                                stop_at = player !== that ? trail.length : Math.max(-1, trail.length - _trail_touch_distance);

                            // Loop over the trail points checking the distance between our head and the points,
                            // pushing any found collisions to the list collisions
                            _.some(trail, function (point, index) {
                                if (index >= stop_at) {
                                    return true; // Simulate a "break;"
                                }

                                // Only consider points that are not holes. Since the most forward point could be a hole
                                // this can lead to "jumping" over other players if one is really lucky and starts a hole
                                // just before a collision. This is not a bug - it's a feature!
                                if (!point.h) {
                                    var distance = Math.sqrt(Math.pow(_x - point.x,2) + Math.pow(_y - point.y,2));

                                    if (distance <= settings.LINE_SIZE) {
                                        collisions.push(distance);
                                    }
                                }
                            });
                        });

                        // Sort the collisions in ascending order
                        collisions.sort(function (left, right) {
                            return left.collision_distance - right.collision_distance;
                        });

                        // Return the length between the two closest colliding bodies or null if no collision
                        // was detected
                        if (collisions.length > 0) {
                            return collisions[0];
                        }
                        return null;
                    },

                    /**
                     * Returns a list of all trail points
                     *
                     * @returns A list of trail points
                     */
                    getTrail = function () {
                        return _trail;
                    },

                    /**
                     * Mark the player killed by setting alive to false
                     */
                    kill = function () {
                        alive = false;
                        console.log("Player " + id + " " +  name + " died!");
                    },

                    /**
                     * Get the name of the player
                     *
                     * @returns string - The name of the player
                     */
                    getName = function () {
                        return name;
                    },

                    /**
                     * Boolean telling if the player is alive or not
                     *
                     * @returns boolean
                     */
                    isAlive = function () {
                        return alive;
                    },

                    /**
                     * Sets command as the last input command. Called from AchtungSimulator.onInputReceived when
                     * input is received from the outside world
                     *
                     * @param command - One of input.COMMANDS
                     */
                    setInternalInputCommand = function (command) {
                        _last_command = command;
                    },

                    /**
                     * Run any initialization code needed before start
                     */
                    start = function () {
                    },

                    /**
                     * Add a point to the players trail
                     *
                     * @param point - Trail point like {x: 1, y: 2}
                     */
                    addTrailPoint = function (point) {
                        _trail.push(point);
                    };

                return {
                    simulate: simulate,
                    draw: draw,
                    getTrail: getTrail,
                    getInputState: getInputState,
                    getCollision: getCollision,
                    kill: kill,
                    getName: getName,
                    start : start,
                    setPlayerData : addTrailPoint,
                    id : id,
                    color : color,
                    isAlive : isAlive,
                    setInternalInputCommand : setInternalInputCommand,
                    receiveExternalUpdate : receiveExternalUpdate,
                    incrementScore : incrementScore,
                    getScore : getScore
                };
            };

        return {
            simulate : simulate,
            receiveExternalUpdate : receiveExternalUpdate,
            start : start,
            setUpPlayerData : setUpPlayerData,
            createPlayer : createPlayer,
            draw : draw,
            onInputReceived : onInputReceived,
            getDesiredTPS : getDesiredTPS
        };
    };

    /**
     * Return a dictionary containing the default options for the game
     * Since the naive collision detection requires that there is at least one trail point every LINE_SIZE-pixel
     * to make it impossible to slip between trail points - we need to set MOVEMENT_SPEED to be equal to LINE_SIZE
     * The actual game speed is controlled by DESIRED_MOVEMENT_SPEED by affecting the result of getDesiredTPS()
     */
    exports.createDefaultOptions = function () {
        var LINE_SIZE = 3,
        options = {
            ALLOW_TPS_COMPENSATION : false,
            TURNING_SPEED : 5,
            MOVEMENT_SPEED : LINE_SIZE, // See function docstring
            LINE_SIZE : LINE_SIZE,
            GAME_WIDTH : 600,
            GAME_HEIGHT : 600
        };

        if (_test_options) {
            options.GAME_WIDTH = 30;
            options.GAME_HEIGHT = 30;
        }

        return options;
    };

    exports.getSimulatorClass = function () {
        return exports.AchtungSimulator;
    };

    var _test_options = false;
    exports.setTestOptions = function (test_options) {
        _test_options = test_options;
    }

})(typeof exports === 'undefined'? this['achtung']={}: exports);
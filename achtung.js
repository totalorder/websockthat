var _ = require('underscore')._;

var renderer = require('./renderer.js');
var shared = require('./shared.js');
var input = require('./input.js');

(function(exports){
    exports.AchtungSimulator = function (tick_sender, options) {
        // Set up internal data structures
        var _last_alive,
            _players = null,
            _players_map = {},

            populatePlayersMap = function () {
                _players_map = {};
                _.each(_players, function (player) {
                    _players_map[player.id] = player;
                });
            },

            onInputReceived = function (player_id, input_command) {
                _players_map[player_id].setInternalInputCommand(input_command);
            },

            /**
             * Run one tick of the simulation
             * Gather input from all players, execute the simulation step, look for collisions and kill
             * any collided players
             */
            simulate = function (delta_time) {
                // Set up internal data structures
                var player_input_states = [],
                    player,
                    i,
                    collisions = [],
                    game_over = false;

                // This should be dependent on _tickInterval if the game doesn't depend on all ticks
                // being equally far apart

                // Fetch the input state from all players. This is done at the same time to ensure that all players'
                // input is sampled at the same time since it can change during the simulation-step
                _.each(_players, function (player) {
                    player_input_states.push(player.getInputState());
                });

                // Run the simulation step for all players, passing along the tick_sender to send off any data generated
                _.each(_players, function (player, index) {
                    player.simulate(delta_time, player_input_states[index], tick_sender);
                });

                // Check for collisions for all players and how close to the impact spot they are
                // They are then sorted and killed in the order of closest to impact spot

                _.each(_players, function (player, index) {
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
                //for (i = 0; i < collisions.length; i++) {
                _.each(collisions, function (collision) {
                    player = collision.player;
                    player.kill();

                    // Check if any one is still alive
                    var players_alive = 0;
                    _.each(_players, function (player) {
                        if (player.isAlive()) {
                            players_alive += 1;
                            _last_alive = player;
                        }
                    });

                    console.log("removing player " + collision.player_number);
                    // Remove the player from the simulation
                    // TODO: Keep the player in the _players list and check for isAlive when accessing the list instead
                    _players.splice(collision.player_number, 1);

                    // End the simulation of one or less players are alive - GAME OVER
                    if (players_alive <= 1) {
                        game_over = true;
                    }
                });

                return game_over;
            },

            /**
             * Reset the world state and rendering engine state, getting ready to start a
             * new game
             */
            start = function(players) {
                _players = players;
                populatePlayersMap();
            },

            setUpPlayerData = function (player_data) {
                player_data.x = options.GAME_WIDTH * 0.1 + Math.random() * options.GAME_WIDTH * 0.8;
                player_data.y = options.GAME_HEIGHT * 0.1 + Math.random() * options.GAME_HEIGHT * 0.8;
                player_data.direction = Math.random() * 360;
            },

            createPlayer = function (player_data, player_settings) {
                return new Player(player_data.id, player_data.name, player_data.input_device, player_data.input_handler, player_settings, player_data.x, player_data.y, player_data.direction, player_data.color);
            },

            draw = function (ctx) {},

            receiveExternalUpdate = function (tick_packet) {
                _.each(_players, function (player) {
                    if (tick_packet.players[player.id]) {
                        player.receiveExternalUpdate(tick_packet.players[player.id]);
                    }
                });
            },

            Player = function (id, name, input_device, input_handler, settings, x, y, direction, color) {

                var _x = x,
                    _y = y,
                    _last_command = input.COMMANDS.LEFT_RIGHT_UP,
                    _direction = direction,
                    _trail = [{x: _x, y: _y}],
                    alive = true,

                    getInputState = function () {
                        return _last_command;
                    },

                    simulate = function (delta_time, input_state, tick_sender) {
                        if (input_state === input.COMMANDS.LEFT_DOWN) {
                            _direction += settings.TURNING_SPEED * delta_time;
                        } else if (input_state === input.COMMANDS.RIGHT_DOWN) {
                            _direction -= settings.TURNING_SPEED * delta_time;
                        }

                        _x += Math.sin(_direction * (Math.PI/180)) * delta_time * settings.MOVEMENT_SPEED;
                        _y += Math.cos(_direction * (Math.PI/180)) * delta_time * settings.MOVEMENT_SPEED;

                        var trail_point = {x: _x, y: _y};
                        _trail.push(trail_point);
                        tick_sender.setPlayerData(id, trail_point);
                    },

                    receiveExternalUpdate = function (data) {
                        addTrailPoint(data);
                    },

                    draw = function (ctx) {
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

                        ctx.fillStyle = color;
                        _.each(_trail, function (point) {
                            // To draw lines between the points:
                            // drawLineBetweenPoints(point, last_point);

                            ctx.beginPath();
                            ctx.arc(point.x, point.y, settings.LINE_SIZE, 0, Math.PI * 2, true);
                            ctx.closePath();
                            ctx.fill();

                            last_point = point;
                        });
                    },

                    getCollision = function (delta_time, players) {
                        var collisions = [],
                            _trail_touch_distance = ((settings.LINE_SIZE*2) / (settings.MOVEMENT_SPEED * delta_time)) + 1,
                            that = this;

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
                                stop_at = player !== that ? trail.length : Math.max(-1, trail.length - _trail_touch_distance);

                            _.some(trail, function (point, index) {
                                if (index >= stop_at) {
                                    return true; // Simulate a "break;"
                                }

                                var distance = Math.sqrt(Math.pow(_x - point.x,2) + Math.pow(_y - point.y,2));

                                if (distance <= settings.LINE_SIZE) {
                                    collisions.push(distance);
                                }
                            });
                        });

                        collisions.sort(function (left, right) {
                            return left.collision_distance - right.collision_distance;
                        });

                        if (collisions.length > 0) {
                            return collisions[0];
                        } else {
                            return null;
                        }
                    },

                    getTrail = function () {
                        return _trail;
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

                    setCommand = function (command) {
                        if (input_handler) {
                            input_handler.setCommand(command);
                        }
                    },

                    _setCommand = function (command) {
                        _last_command = command;
                    },

                    start = function () {
                        if (input_device) {
                            input_device.start(id);
                        }

                        if (input_handler) {
                            input_handler.start(this, _setCommand);
                        }
                    },

                    addTrailPoint = function (point) {
                        _trail.push(point);
                };

                return {
                    simulate: simulate,
                    draw: draw,
                    getTrail: getTrail,
                    getInputState: getInputState,
                    getCollision: getCollision,
                    setCommand: setCommand,
                    kill: kill,
                    getName: getName,
                    start : start,
                    setPlayerData : addTrailPoint,
                    id : id,
                    color : color,
                    isAlive : isAlive,
                    setInternalInputCommand : _setCommand, // TODO: Not private anymore. Clean up,
                    receiveExternalUpdate : receiveExternalUpdate
                };
            };

        return {
            simulate : simulate,
            receiveExternalUpdate : receiveExternalUpdate,
            start : start,
            setUpPlayerData : setUpPlayerData,
            createPlayer : createPlayer,
            draw : draw,
            onInputReceived : onInputReceived
        };
    };

    exports.createDefaultOptions = function () {
        return {
            // The desired number of ticks per second
            DESIRED_TPS : 20,
            TURNING_SPEED : 5,
            MOVEMENT_SPEED : 10,
            LINE_SIZE : 3,
            GAME_WIDTH : 800,
            GAME_HEIGHT : 800
        };
    };

    exports.getSimulatorClass = function () {
        return exports.AchtungSimulator;
    };

})(typeof exports === 'undefined'? this['achtung']={}: exports);
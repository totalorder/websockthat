var renderer = require('./renderer.js');
var player = require('./player.js');
var shared = require('./shared.js');
var input = require('./input.js');

(function(exports){
    exports.AchtungSimulator = function (outputHandler, options) {
        // Define te game specific settings
        var TURNING_SPEED = options.TURNING_SPEED;
        var MOVEMENT_SPEED = options.MOVEMENT_SPEED;
        var LINE_SIZE = options.LINE_SIZE;

        // Set up internal data structures
        var _lastAlive;
        var _players = null;
        var _playersMap = {};

        var inputQueue = [];

        var populatePlayersMap = function () {
            _playersMap = {};
            for (var i = 0; i < _players.length; i++) {
                _playersMap[_players[i].id] = _players[i];
            }
        };

         // Do this in setup/teardown

        var addInput = function (player_id, input_command) {
            //inputQueue.push({player_id : player_id, input_command : input_command});
            _playersMap[player_id].setInternalInputCommand(input_command);
        };

        /*var applyInput = function () {
            for (var i; i < inputQueue.length; i++) {
                var inputCommand = inputQueue[i];
                if (_playersMap[inputCommand.player_id]) {
                    _playersMap[inputCommand.player_id].setInternalInputCommand(inputCommand.input_command);
                }
            }
        };*/

        /**
         * Run one tick of the simulation
         * Gather input from all players, execute the simulation step, look for collissions and kill
         * any collided players
         */
        var simulate = function (deltaTime) {
            // Set up internal data structures
            var playerInputStates = [];
            var player;
            var i;
            // This should be dependent on _tickInterval if the game doesn't depend on all ticks
            // being equally far apart

            // Fetch the input state from all players. This is done at the same time to ensure that all players'
            // input is sampled at the same time since it can change during the simulation-step
            for (i = 0; i < _players.length; i++) {
                player = _players[i];
                playerInputStates.push(player.getInputState());
            }

            // Run the simulation step for all players, passing along the outputHandler to send off any data generated
            for (i = 0; i < _players.length; i++) {
                player = _players[i];
                player.simulate(deltaTime, playerInputStates[i], outputHandler);
            }

            // Check for collissions for all players and how close to the impact spot they are
            // They are then sorted and killed in the order of closest to impact spot
            var collisions = [];
            for (i = 0; i < _players.length; i++) {
                player = _players[i];
                var collission_distance = player.getCollision(deltaTime, _players);
                if (collission_distance != null) {
                    collisions.push({'player': player, 'collision_distance': collission_distance, 'player_number' : i});
                }
            }

            // Sort our collissions in the order of closest to impact spot
            collisions.sort(function (left, right) {
                return left.collision_distance - right.collision_distance;
            });

            // Kill off players in the order of closest to impact spot
            // End the simulation if there is only one player alive, making hen the winner
            for (i = 0; i < collisions.length; i++) {
                player = collisions[i].player;
                player.kill();

                // Check if any one is still alive
                var players_alive = 0;
                for (var it = 0; it < _players.length; it++) {
                    if (_players[it].isAlive()) {
                        players_alive ++;
                        _lastAlive = player;
                    }
                }

                console.log("removing player " + collisions[i].player_number);
                // Remove the player from the simulation
                // TODO: Keep the player in the _players list and check for isAlive when accessing the list instead
                _players.splice(collisions[i].player_number, 1);

                // End the simulation of one or less players are alive - GAME OVER
                if (players_alive <= 1) {
                    return true;
                }
            }
        };

        /**
         * Reset the world state and rendering engine state, getting ready to start a
         * new game
         */
        var start = function(players) {
            _players = players;
            populatePlayersMap();
        };

        var setUpPlayerData = function (player_data) {
            player_data.x = options.GAME_WIDTH * 0.1 + Math.random() * options.GAME_WIDTH * 0.8;
            player_data.y = options.GAME_HEIGHT * 0.1 + Math.random() * options.GAME_HEIGHT * 0.8;
            player_data.direction = Math.random() * 360;
        };

        var createPlayer = function (player_data, player_settings) {
            return new Player(player_data.id, player_data.name, player_data.input_device, player_data.input_handler, player_settings, player_data.x, player_data.y, player_data.direction, player_data.color);
        };

        var draw = function (ctx) {};

        var Player = function (id, name, input_device, input_handler, settings, x, y, direction, color) {

            var _x = x;
            var _y = y;
            var _lastCommand = input.COMMANDS.LEFT_RIGHT_UP;
            var _direction = direction;
            var _trail = [{x: _x, y: _y}];
            var alive = true;
            var getInputState = function () {
                return _lastCommand;
            };

            var simulate = function (deltaTime, inputState, outputHandler) {
                if (inputState == input.COMMANDS.LEFT_DOWN) {
                    _direction += settings.TURNING_SPEED * deltaTime;
                } else if (inputState == input.COMMANDS.RIGHT_DOWN) {
                    _direction -= settings.TURNING_SPEED * deltaTime;
                }
                //console.log(deltaTime);
                _x += Math.sin(_direction * (Math.PI/180)) * deltaTime * settings.MOVEMENT_SPEED;
                _y += Math.cos(_direction * (Math.PI/180)) * deltaTime * settings.MOVEMENT_SPEED;

                var trail_point = {x: _x, y: _y};
                _trail.push(trail_point);
                outputHandler.addTrailPoint(id, trail_point);
            };

            var draw = function (ctx) {
                var trail = _trail;
                ctx.fillStyle = color;
                var lastPoint = false;
                for (var it = 0; it < trail.length; it++) {
                    var point = trail[it];
                    if(false && lastPoint) {
                        ctx.beginPath();
                        ctx.moveTo(lastPoint.x, lastPoint.y);
                        ctx.lineTo(point.x, point.y);
                        ctx.closePath();
                        ctx.stroke();
                    }
                    //ctx.fillRect(Math.floor(point.x),100,10,10);
                    //console.log(point);

                    ctx.beginPath();
                    ctx.arc(point.x, point.y, settings.LINE_SIZE, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.fill();

                    lastPoint = point;
                }
            };

            var getCollision = function (deltaTime, players) {
                var player;
                var collisions = [];

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

                //console.log(settings.MOVEMENT_SPEED, settings.LINE_SIZE);
                var _trailTouchDistance = ((settings.LINE_SIZE*2) / (settings.MOVEMENT_SPEED * deltaTime)) + 1;

                for (var i = 0; i < players.length; i++) {
                    player = players[i];

                    var trail = player.getTrail();
                    var stopAt = player != this ? trail.length : Math.max(-1, trail.length - _trailTouchDistance);
                    for (var ti = 0; ti < stopAt; ti++) {
                        var point = trail[ti];
                        var distance = Math.sqrt(Math.pow(_x - point.x,2) + Math.pow(_y - point.y,2));
                        if (distance <= settings.LINE_SIZE) {
                            collisions.push(distance);
                        }
                    }
                }

                collisions.sort(function (left, right) {
                    return left.collision_distance - right.collision_distance;
                });

                if (collisions) {
                    return collisions[0];
                } else {
                    return null;
                }
            };

            var getTrail = function () {
                return _trail;
            };

            var kill = function () {
                alive = false;
                console.log("Player " + id + " " +  name + " died!");
            };

            var getName = function () {
                return name;
            };

            var isAlive = function () {
                return alive;
            };

            var setCommand = function (command) {
                if (input_handler) {
                    input_handler.setCommand(command);
                }
            };

            var _setCommand = function (command) {
                _lastCommand = command;
            };

            var start = function () {
                if (input_device) {
                    input_device.start(id);
                }

                if (input_handler) {
                    input_handler.start(this, _setCommand);
                }

            };

            var addTrailPoint = function (point) {
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
                addTrailPoint : addTrailPoint,
                id : id,
                color : color,
                isAlive : isAlive,
                setInternalInputCommand : _setCommand // TODO: Not private anymore. Clean up
            };
        };

        return {
            simulate : simulate,
            addInput : addInput,
            start : start,
            setUpPlayerData : setUpPlayerData,
            createPlayer : createPlayer,
            draw : draw
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
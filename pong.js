"use strict";

var renderer = require('./renderer.js');
var shared = require('./shared.js');
var input = require('./input.js');

(function(exports){
    exports.PongSimulator = function (outputHandler, options) {
        // Define te game specific settings
        var MOVEMENT_SPEED = options.MOVEMENT_SPEED;
        var LINE_SIZE = options.LINE_SIZE;

        // Set up internal data structures
        var _lastAlive;
        var _players = null;
        var _playersMap = {};
        var _ball = {x : options.GAME_WIDTH / 2, y : options.GAME_HEIGHT / 2};

        var populatePlayersMap = function () {
            _playersMap = {};
            for (var i = 0; i < _players.length; i++) {
                _playersMap[_players[i].id] = _players[i];
            }
        };

         // Do this in setup/teardown

        var addInput = function (player_id, input_command) {
            _playersMap[player_id].setInternalInputCommand(input_command);
        };

        /**
         * Run one tick of the simulation
         * Gather input from all players, execute the simulation step, look for collisions and kill
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

            _ball.x += Math.sin(_ball.direction * (Math.PI/180)) * deltaTime * options.MOVEMENT_SPEED * 10;
            _ball.y += Math.cos(_ball.direction * (Math.PI/180)) * deltaTime * options.MOVEMENT_SPEED * 10;

            outputHandler.getTickPacket().ball = {x: _ball.x, y : _ball.y};

            // Check for collisions for all players and how close to the impact spot they are
            // They are then sorted and killed in the order of closest to impact spot
            var collisions = [];
            for (i = 0; i < _players.length; i++) {
                player = _players[i];
                var collision = player.getCollision(deltaTime, _players);
                if (collision) {
                    //player.kill();
                    //console.log("player " + player.getName() + " lost!");
                    bounceHorizontal();
                }
            }

            if (_ball.y < options.LINE_SIZE || _ball.y > options.GAME_HEIGHT - options.LINE_SIZE) {
                bounceVertical();
            }

            if (_ball.x < 0) {
                _players[0].kill();
                return true;
            }

            if (_ball.x > options.GAME_WIDTH) {
                _players[1].kill();
                return true;
            }
        };

        var draw = function (ctx) {
            ctx.beginPath();
            ctx.arc(_ball.x, _ball.y, options.LINE_SIZE, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
        };

        var receiveUpdate = function (tick_packet) {
            console.log(tick_packet);
            _ball.x = tick_packet.ball.x;
            _ball.y = tick_packet.ball.y;
        };

        var bounceHorizontal = function () {
            _ball.direction = 360 - _ball.direction;
        };

        var bounceVertical = function () {
            _ball.direction = ((360 - _ball.direction) + 180) % 360
        };

        /**
         * Reset the world state and rendering engine state, getting ready to start a
         * new game
         */
        var start = function(players) {
            _ball = {x: options.GAME_WIDTH /2, y : options.GAME_HEIGHT / 2, direction : Math.random() * 360 };
            _players = players;
            populatePlayersMap();
        };

        var setUpPlayerData = function (player_data) {
            if (player_data.id == 0) {
                player_data.x = 10;
            } else {
                player_data.x = options.GAME_WIDTH - 10;
            }
            player_data.y = options.GAME_HEIGHT * 0.1 + Math.random() * options.GAME_HEIGHT * 0.8;
            //player_data.direction = Math.random() * 360;
        };

        var createPlayer = function (player_data, player_settings) {
            return new Player(player_data.id, player_data.name, player_data.input_device, player_data.input_handler, player_settings, player_data.x, player_data.y, player_data.direction, player_data.color);
        };

        var Player = function (id, name, input_device, input_handler, settings, x, y, direction, color) {

            var _x = x;
            var _y = y;
            var _lastCommand = input.COMMANDS.LEFT_RIGHT_UP;
            var alive = true;
            var getInputState = function () {
                return _lastCommand;
            };

            var simulate = function (deltaTime, inputState, outputHandler) {
                if (inputState == input.COMMANDS.LEFT_DOWN) {
                    if (_y > options.PADDLE_HEIGHT / 2) {
                        _y -= settings.MOVEMENT_SPEED * deltaTime;
                    }
                } else if (inputState == input.COMMANDS.RIGHT_DOWN) {
                    if (_y < options.GAME_HEIGHT - options.PADDLE_HEIGHT / 2) {
                        _y += settings.MOVEMENT_SPEED * deltaTime;
                    }
                }

                var player_tick_data = outputHandler.getTickPacketPlayerData(id);
                player_tick_data.paddle_position = _y;
            };

            var getCollision = function (deltaTime, players) {
                if (_ball.x > _x - options.LINE_SIZE &&
                    _ball.x < _x + options.LINE_SIZE &&
                    _ball.y > _y - options.PADDLE_HEIGHT / 2 &&
                    _ball.y < _y + options.PADDLE_HEIGHT / 2) {
                    return true;
                }
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

            var receiveUpdate = function (packet) {
                _y = packet.paddle_position;
            };

            var draw = function (ctx) {
                ctx.fillRect(x - options.LINE_SIZE / 2, _y - options.PADDLE_HEIGHT / 2,
                             options.LINE_SIZE, options.PADDLE_HEIGHT);
            };

            return {
                simulate: simulate,
                getInputState: getInputState,
                setCommand: setCommand,
                getCollision: getCollision,
                receiveUpdate: receiveUpdate,
                kill: kill,
                draw: draw,
                getName: getName,
                start : start,
                id : id,
                color : color,
                isAlive : isAlive,
                setInternalInputCommand : _setCommand // TODO: Not private anymore. Clean up
            };
        };

        return {
            simulate : simulate,
            addInput : addInput,
            draw : draw,
            start : start,
            setUpPlayerData : setUpPlayerData,
            createPlayer : createPlayer
        };
    };

    exports.createDefaultOptions = function () {
        return {
            // The desired number of ticks per second
            DESIRED_TPS : 20,
            TURNING_SPEED : 10,
            MOVEMENT_SPEED : 10,
            LINE_SIZE : 3,
            GAME_WIDTH : 200,
            GAME_HEIGHT : 200,
            PADDLE_HEIGHT : 40
        };
    };

    exports.getSimulatorClass = function () {
        return exports.PongSimulator;
    };

})(typeof exports === 'undefined'? this['pong']={}: exports);
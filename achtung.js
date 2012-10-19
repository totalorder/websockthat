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
            for (var i; i < _players.length; i++) {
                _playersMap[_players[i].id] = _players[i];
            }
        };

         // Do this in setup/teardown

        var addInput = function (player_id, input_command) {
            inputQueue.push({player_id : player_id, input_command : input_command});
        };

        var applyInput = function () {
            for (var i; i < inputQueue.length; i++) {
                var inputCommand = inputQueue[i];
                if (_playersMap[inputCommand.player_id]) {
                    _playersMap[inputCommand.player_id].setInternalInputCommand(inputCommand.input_command);
                }
            }
        };

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

        return {
            simulate : simulate,
            addInput : addInput,
            start : start

        };

    };
})(typeof exports === 'undefined'? this['achtung']={}: exports);
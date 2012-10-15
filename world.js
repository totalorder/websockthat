var World = function () {
    var DESIRED_TPS = 20; // The desired number of ticks per second
    var MAX_TICKS = 350;

    var COMMANDS = {
        LEFT_DOWN : 'LEFT_DOWN',
        RIGHT_DOWN : 'RIGHT_DOWN',
        LEFT_RIGHT_UP : 'LEFT_RIGHT_UP'
        //LEFT_UP : 'LEFT_UP',
        //RIGHT_UP : 'RIGHT_UP'
    };
    var TURNING_SPEED = 10;
    var MOVEMENT_SPEED = 10;
    var LINE_SIZE = 3;

    var MAX_MOVEMENT_SPEED = LINE_SIZE;
    DESIRED_TPS = (MOVEMENT_SPEED / LINE_SIZE) * MOVEMENT_SPEED;
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

    // Exposed by public function getTicksPerSecondText()

    var rendering_settings = {
        LINE_SIZE : LINE_SIZE
    };

    if (DESIRED_TPS == 0) {
        DESIRED_TPS = 1000;
        _desiredTickInterval = 1000 / DESIRED_TPS;
        _renderingEngine = new StubRenderer("canvas", null, null, rendering_settings);
    } else {
        _renderingEngine = new CanvasRenderer("canvas", null, null, rendering_settings);
    }

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
    var _addPlayer = function (player_data) {
        var player_settings = {
            COMMANDS : COMMANDS,
            TURNING_SPEED : TURNING_SPEED,
            LINE_SIZE : LINE_SIZE,
            MOVEMENT_SPEED : MOVEMENT_SPEED
        };

        if (!_gameStarted) {
            var player = new Player(player_data.name, player_settings);
            var input = new LocalInputDevice(player, player_data.keys, COMMANDS)
            _players.push(player);
            input.start();
        }
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

        for (i = 0; i < _players.length; i++) {
            player = _players[i];
            player.simulate(deltaTime, playerInputStates[i]);
        }

        var collisions = [];
        for (i = 0; i < _players.length; i++) {
            player = _players[i];
            //console.log("player number", i);
            var collission_distance = player.getCollision(deltaTime, _players);
            if (collission_distance) {
                collisions.push({'player': player, 'collision_distance': collission_distance, 'player_number' : i});
            }
        }

        collisions.sort(function (left, right) {
            return left.collision_distance - right.collision_distance;
        });

        for (i = 0; i < collisions.length; i++) {
            player = collisions[i].player;
            player.kill();

            //console.log("removing player " + _players[collisions[i].player_number].getName());
            console.log("removing player " + collisions[i].player_number);
            _players.splice(collisions[i].player_number, 1);
        }
    };

    var startGame = function (players, _restartCallback) {
        if (_gameStarted) {
            return;
        }
        console.log("starting game");
        for (i = 0; i < players.length; i++) {
            _addPlayer(players[i]);
        }


        var i;
        var self = this;

        for (i = 0; i < _players.length; i++) {
            var player = _players[i];
            // Make sure that all players are in the game
            //_log("Creating new player " + _players[i].getName() + " at x=" + _players[i].getX() + ", y=" + _players[i].getY());
            _renderingEngine.create(player);
        }

        _renderingEngine.start();

        _gameStarted = true;

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
            }
            else {
                if (_numberOfTicks >= MAX_TICKS) {
                    message = "No winner! Time out!\n";
                } else  {
                    message = "Winner is " + _players[_lastAlive].getName() + "\n\nKills\n";
                }

                var results = {'winner' : _players[_lastAlive].getName(), 'scores' : {}};
                for ( i = 0; i < _players.length; i++ ) {
                    message += _players[i].getName() + ": " + _players[i].getKillCount() + "\n";
                    results[_players[i].getName()] = _players[i].getKillCount();
                }
                _log(message);
                alert(message);
                _gameStarted = false;
                if(_restartCallback) {
                    _restartCallback(results);
                }
            }
        })();
    };

    var clear = function() {
        _renderingEngine.clear();
        _currentplayerIndex = 0;
        _numberOfTicks = 0;
        _players = [];
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

    return {
        clear : clear,
        startGame : startGame,
        log : log,
        getTicksPerSecondText:getTicksPerSecondText,
        getTickDurationRatio:getTickDurationRatio,
        getLogData:getLogData
    };

}();
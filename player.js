var input = require('./input.js');

(function(exports){
    exports.Player = function (id, name, input_device, input_handler, settings, x, y, direction, color) {

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

        //var getID = function () {
        //    return id;
        //};

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
})(typeof exports === 'undefined'? this['player']={}: exports);
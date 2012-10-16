var input = require('./input.js');

(function(exports){
    exports.Player = function (id, name, input_device, settings) {
        //var input_device = null;

        var _x = 20;
        var _y = 20;
        var _lastCommand = input.COMMANDS.LEFT_RIGHT_UP;
        var _direction = 45;
        var _trail = [{x: _x, y: _y}];

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
            //console.log(settings.MOVEMENT_SPEED, settings.LINE_SIZE);
            var _trailTouchDistance = (settings.LINE_SIZE*2) / (settings.MOVEMENT_SPEED * deltaTime) ;

            for (var i = 0; i < players.length; i++) {
                player = players[i];

                var trail = player.getTrail();
                var stopAt = player != this ? trail.length : Math.max(-1, trail.length - _trailTouchDistance);
                //console.log('trail', trail.length);
                //console.log('stopAt', stopAt);
                //console.log("playerthis", player == this);
                for (var ti = 0; ti < stopAt; ti++) {
                    var point = trail[ti];
                    var distance = Math.sqrt(Math.pow(_x - point.x,2) + Math.pow(_y - point.y,2));
                    //point.distance = distance;
                    if (distance <= settings.LINE_SIZE) {
                        //console.log("crashed at", _x, _y, distance, point.x, point.y, settings.LINE_SIZE);
                        //point.crashed = {x: _x, y : _y};
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
            console.log("Player " +  name + " died!");
        };

        var getName = function () {
            return name;
        };

        var setCommand = function (command) {
            _lastCommand = command;
        };

        var start = function () {
            //input_device = input_device_class(this);
            input_device.start(this);
        };

        return {
            simulate: simulate,
            getTrail: getTrail,
            getInputState: getInputState,
            getCollision: getCollision,
            setCommand: setCommand,
            kill: kill,
            getName: getName,
            start : start
        };
    };
})(typeof exports === 'undefined'? this['player']={}: exports);
var shared = require('./shared.js');

(function(exports){
    exports.COMMANDS = {
        LEFT_DOWN : 'LEFT_DOWN',
        RIGHT_DOWN : 'RIGHT_DOWN',
        LEFT_RIGHT_UP : 'LEFT_RIGHT_UP'
        //LEFT_UP : 'LEFT_UP',
        //RIGHT_UP : 'RIGHT_UP'
    };

    exports.LocalInputDevice = function (player, keys) {
        var _lastCommandKeyCode = null;

        var getKeyCommand = function (keyCode) {
            switch (keyCode) {
                case keys.left:
                    return exports.COMMANDS.LEFT_DOWN;
                    break;
                case keys.right:
                    return exports.COMMANDS.RIGHT_DOWN;
                    break;
            }
            return null;
        };

        var doKeyDown = function (evt){
            var issuedCommand = getKeyCommand(evt.keyCode);
            if (issuedCommand) {
                _lastCommandKeyCode = evt.keyCode;
                player.setCommand(issuedCommand);
            }
        };

        var doKeyUp = function (evt){
            //var issuedCommand = getKeyCommand(evt.keyCode);
            if(evt.keyCode == _lastCommandKeyCode) {
                _lastCommandKeyCode = null;
                player.setCommand(exports.COMMANDS.LEFT_RIGHT_UP);
            }
        };

        return {
            start : function () {
                window.addEventListener('keydown',doKeyDown,true);
                window.addEventListener('keyup',doKeyUp,true);
            }
        };
    };

    exports.WSInputDevice = function () {
        var _lastCommandKeyCode = null;
        var _started = false;
        var player = null;

        return {
            start : function (the_player) {
                player = the_player;
                _started = true;
            },

            onInputCallback : function (input_command) {
                if (_started) {
                    player.setCommand(input_command);
                }
            }
        };
    };
})(typeof exports === 'undefined'? this['input']={}: exports);
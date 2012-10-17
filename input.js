var shared = require('./shared.js');

(function(exports){
    exports.COMMANDS = {
        LEFT_DOWN : 'LEFT_DOWN',
        RIGHT_DOWN : 'RIGHT_DOWN',
        LEFT_RIGHT_UP : 'LEFT_RIGHT_UP'
        //LEFT_UP : 'LEFT_UP',
        //RIGHT_UP : 'RIGHT_UP'
    };

    exports.LocalInputDevice = function (keys) {
        var _lastCommandKeyCode = null;
        var _player = null;

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
                _player.setCommand(issuedCommand);
            }
        };

        var doKeyUp = function (evt){
            //var issuedCommand = getKeyCommand(evt.keyCode);
            if(evt.keyCode == _lastCommandKeyCode) {
                _lastCommandKeyCode = null;
                _player.setCommand(exports.COMMANDS.LEFT_RIGHT_UP);
            }
        };

        return {
            start : function (player) {
                _player = player;
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

    exports.LocalInputHandler = function () {
        var _started = false;
        var player = null;
        var player_setCommand = null;

        return {
            start : function (the_player, player_setCommand_) {
                player = the_player;
                player_setCommand = player_setCommand_;
                _started = true;
            },

            setCommand : function (command) {
                if (_started) {
                    player_setCommand(command);
                }
            }
        };
    };

    exports.RemoteWSInputHandler = function (webSocket) {
        var _started = false;
        var player = null;
        var player_setCommand = null;

        return {
            start : function (the_player, player_setCommand_) {
                player = the_player;
                player_setCommand = player_setCommand_;
                _started = true;
            },

            setCommand : function (command) {
                if (_started) {
                    webSocket.sendObject(shared.createInputPacket(command));
                }
            }
        };
    };
})(typeof exports === 'undefined'? this['input']={}: exports);
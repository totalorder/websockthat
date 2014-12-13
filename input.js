define(function () {
    "use strict";

    /*
     * Input device that reads input from the keyboard and triggers input commands on _player
     * and on specialKeyCommandsCallback
     *
     * @param keys - An object describing which keyCodes match which commands from game.INPUT_COMMANDS
     *             Should look like:
     *                    37 : {'down' : game.INPUT_COMMANDS.LEFT_DOWN, 'up' : game.INPUT_COMMANDS.LEFT_RIGHT_UP},
     *                    40 : {'down' : game.INPUT_COMMANDS.RIGHT_DOWN, 'up' : game.INPUT_COMMANDS.LEFT_RIGHT_UP},
     *                    32 : {'down' : game.INPUT_COMMANDS.START, 'up' : null, 'local' : true}}
     * @param localKeyCommandsCallback - Callback to be called with commands that are marked as "local", and
     *                                   should not be sent to the server
     */
    var LocalInputDevice = function (keys, localKeyCommandsCallback) {
        var _last_command_key_code = null,
            _player_id = null,
            _onCommandCallback = null,

            _init = function () {
                // Start listening to keyboard events
                window.addEventListener('keydown', doKeyDown, true);
                window.addEventListener('keyup', doKeyUp, true);
            },

            getPlayerKeyCommand = function (key_code, direction) {
                return {'cmd' : keys[key_code] && keys[key_code][direction] ? keys[key_code][direction] : null,
                        'local' : keys[key_code] && keys[key_code].local};
            },

            /*
             * Returns true if key code is a scrolling key, like left/right/up/down or space.
             * TODO: Kind of lame way to disable scrolling, should be improved
             */
            isScrollingKey = function (key_code) {
                return (key_code >= 37 && key_code <= 40) || key_code === 32;
            },

            /*
             * Tiggered when a key is pressed down. Will result in either _player.setCommand() or localKeyCommandsCallback
             * being called with a COMMAND as argument
             * @param evt - keyboard event
             */
            doKeyDown = function (evt) {
                var issued_command = getPlayerKeyCommand(evt.keyCode, 'down');
                if (issued_command && issued_command.cmd && evt.keyCode !== _last_command_key_code) {
                    if (issued_command.local) {
                        localKeyCommandsCallback(issued_command.cmd);
                    } else if (_player_id !== null) {
                        _last_command_key_code = evt.keyCode;
                        _onCommandCallback(_player_id, issued_command.cmd);
                    }
                }

                if (isScrollingKey(evt.keyCode)) {
                    evt.preventDefault();
                }
            },

            /*
             * Tiggered when a key is released. Will result _player.setCommand()
             * being called with a COMMANDS.LEFT_RIGHT_UP as argument
             * @param evt - keyboard event
             */
            doKeyUp = function (evt) {
                var issued_command;
                if (evt.keyCode === _last_command_key_code) {
                    issued_command = getPlayerKeyCommand(evt.keyCode, 'up');
                    if (issued_command && issued_command.cmd) {
                        if (issued_command.local) {
                            localKeyCommandsCallback(issued_command.cmd);
                        } else if (_player_id !== null) {
                            _last_command_key_code = null;
                            _onCommandCallback(_player_id, issued_command.cmd);
                        }
                    }
                }
                if (isScrollingKey(evt.key_code)) {
                    evt.preventDefault();
                }
        };

        _init();

        return {
            start : function (player_id, onCommandCallback) {
                _player_id = player_id;
            },

            doKeyDown : doKeyDown,
            doKeyUp : doKeyUp,

            setOnCommandCallback : function (callback) {
                _onCommandCallback = callback;
            }
        };
    };
    return {
        LocalInputDevice : LocalInputDevice
    }
});
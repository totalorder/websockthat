"use strict";

var communication = require("./communication.js");
var websocktransport = require('./websocktransport.js');

(function(exports){

    // The defined input commands that can be triggered
    exports.COMMANDS = {
        LEFT_DOWN : 'LEFT_DOWN',
        RIGHT_DOWN : 'RIGHT_DOWN',
        LEFT_RIGHT_UP : 'LEFT_RIGHT_UP',
        START : 'START'
    };

    /**
     * Input device that reads input from the keyboard and triggers input commands on _player
     * and on specialKeyCommandsCallback
     *
     * @param keys - An object describing which keyCodes to match to which trigger
     *               Should look like: {left : 37, right : 40, start : 32}
     * @param specialKeyCommandsCallback - The callback that should handle special keys,
     *                                     that are not player controlling keys. For example 'start'
     */
    exports.LocalInputDevice = function (keys, specialKeyCommandsCallback) {
        var _last_command_key_code = null,
            _player_id = null,
            _onCommandCallback = null,

            _init = function () {
                // Start listening to keyboard events
                window.addEventListener('keydown',doKeyDown,true);
                window.addEventListener('keyup',doKeyUp,true);
            },

            /*
             * Get the COMMAND that represents keyCode among the commands that control the player
             * @param key_code - The integer number representing a keyboard key
             * @return One of exports.COMMANDS
             */
            getPlayerKeyCommand = function (key_code) {
                switch (key_code) {
                    case keys.left:
                        return exports.COMMANDS.LEFT_DOWN;
                        break;
                    case keys.right:
                        return exports.COMMANDS.RIGHT_DOWN;
                        break;
                }
                return null;
            },

        /*
             * Returns true if key code is a scrolling key, like left/right/up/down or space.
             * TODO: Kind of lame way to disable scrolling, should be improved
             */
            isScrollingKey = function (key_code) {
                return (key_code >= 37 && key_code <= 40) || key_code === 32;
            },

            /*
             * Get the COMMAND that represents keyCode among the commands that doesn't control the player
             * @param keyCode - The integer number representing a keyboard key
             * @return One of exports.COMMANDS
             */
            getSpecialKeyCommand = function (key_code) {
                switch (key_code) {
                    case keys.start:
                        return exports.COMMANDS.START;
                        break;
                }
                return null;
            },

            /*
             * Tiggered when a key is pressed down. Will result in either _player.setCommand() or specialKeyCommandsCallback
             * being called with a COMMAND as argument
             * @param evt - keyboard event
             */
            doKeyDown = function (evt){
                var issued_command = null;
                if (_player_id !== null) {
                    issued_command = getPlayerKeyCommand(evt.keyCode);
                }
                if (issued_command && evt.keyCode !== _last_command_key_code) {
                    _last_command_key_code = evt.keyCode;
                    _onCommandCallback(_player_id, issued_command);
                } else {

                    issued_command = getSpecialKeyCommand(evt.keyCode);
                    if (issued_command) {
                        specialKeyCommandsCallback(issued_command);
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
            doKeyUp = function (evt){
                if(_player_id !== null) {
                    if(evt.keyCode === _last_command_key_code) {
                        _last_command_key_code = null;
                        _onCommandCallback(_player_id, exports.COMMANDS.LEFT_RIGHT_UP);
                    }
                }
                if (isScrollingKey(evt.key_code)) {
                    evt.preventDefault();
                }
        };

        /* Hacked together mobile phone tilt-support
         * Needs a code review
        window.addEventListener('touchstart', function (e) {
            specialKeyCommandsCallback(exports.COMMANDS.START);
        });

        window.addEventListener('devicemotion', function (e) {
            ax = e.accelerationIncludingGravity.x;
            if (ax > 3.5) {
                doKeyDown({keyCode: keys.right});
            } else if (ax < -3.5) {
                doKeyDown({keyCode: keys.left});
            } else {
                doKeyUp({keyCode: _last_command_key_code});
            }
            //ay = -e.accelerationIncludingGravity.y;
            //console.log
        });
        */

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
})(typeof exports === 'undefined'? this['input']={}: exports);
var shared = require('./shared.js');

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
    exports.LocalInputDevice = function (keys, onCommandCallback, specialKeyCommandsCallback) {
        var _lastCommandKeyCode = null;
        var _player_id = null;
        var _onCommandCallback = onCommandCallback;

        /**
         * Get the COMMAND that represents keyCode among the commands that control the player
         * @param keyCode - The integer number representing a keyboard key
         * @return One of exports.COMMANDS
         */
        var getPlayerKeyCommand = function (keyCode) {
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

        /**
         * Get the COMMAND that represents keyCode among the commands that doesn't control the player
         * @param keyCode - The integer number representing a keyboard key
         * @return One of exports.COMMANDS
         */
        var getSpecialKeyCommand = function (keyCode) {
            switch (keyCode) {
                case keys.start:
                    return exports.COMMANDS.START;
                    break;
            }
            return null;
        };

        /**
         * Tiggered when a key is pressed down. Will result in either _player.setCommand() or specialKeyCommandsCallback
         * being called with a COMMAND as argument
         * @param evt - keyboard event
         */
        var doKeyDown = function (evt){
            var issuedCommand = null;
            if (_player_id != null) {
                issuedCommand = getPlayerKeyCommand(evt.keyCode);
            }
            if (issuedCommand) {
                _lastCommandKeyCode = evt.keyCode;
                _onCommandCallback(_player_id, issuedCommand);
            } else {

                issuedCommand = getSpecialKeyCommand(evt.keyCode);
                if (issuedCommand) {
                    specialKeyCommandsCallback(issuedCommand);
                }
            }
        };

        /**
         * Tiggered when a key is released. Will result _player.setCommand()
         * being called with a COMMANDS.LEFT_RIGHT_UP as argument
         * @param evt - keyboard event
         */
        var doKeyUp = function (evt){
            if(_player_id != null) {
                if(evt.keyCode == _lastCommandKeyCode) {
                    _lastCommandKeyCode = null;
                    _onCommandCallback(_player_id, exports.COMMANDS.LEFT_RIGHT_UP);
                }
            }
        };

        // Start listening to keyboard events
        window.addEventListener('keydown',doKeyDown,true);
        window.addEventListener('keyup',doKeyUp,true);

        return {
            start : function (player_id) {
                _player_id = player_id;
            }
        };
    };

    /**
     * An input device that exposes a listener callback onInputCallback
     * which will trigger player.setCommand()
     */
    exports.WSInputDevice = function (webSocket, onCommandCallback, player_id) {
        var _started = false;

        var onInputCallback = function (input_command) {
            if (_started) {
                onCommandCallback(player_id, input_command);
            }
        };

        return {
            /**
             * Set _player to the current player. Will enable the onInputCallback listener
             * @param the_player
             */
            start : function (the_player) {
                if (!_started) {
                    // Hook up the InputDevice.onInputCallback to all incoming packets of type INPUT
                    // from the clients websocket
                    webSocket.registerReceivedPacketCallback(shared.PACKET_TYPES.INPUT, function (packet) { return packet.command; }, onInputCallback);
                }

                _started = true;
            },

            onInputCallback : onInputCallback
        };
    };

    /**
     * An input handler that reacts on incoming input by triggering the command on the local player object
     */
    exports.LocalInputHandler = function () {
        var _started = false;
        var player = null;
        var player_setCommand = null;

        return {
            /**
             * Enable the setCommand trigger
             * @param the_player - A local player object
             * @param player_setCommand_ - The function to call to set a command on the player
             */
            start : function (the_player, player_setCommand_) {
                player = the_player;
                player_setCommand = player_setCommand_;
                _started = true;
            },

            setCommand : function (player_id, command) {
                if (_started) {
                    player_setCommand(command);
                }
            }
        };
    };
})(typeof exports === 'undefined'? this['input']={}: exports);
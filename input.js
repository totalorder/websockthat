
var LocalInputDevice = function (player, keys, commands) {
    var _lastCommandKeyCode = null;

    var getKeyCommand = function (keyCode) {
        switch (keyCode) {
            case keys.left:
                return commands.LEFT_DOWN;
                break;
            case keys.right:
                return commands.RIGHT_DOWN;
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
            player.setCommand(commands.LEFT_RIGHT_UP);
        }
    };

    return {
        start : function () {
            window.addEventListener('keydown',doKeyDown,true);
            window.addEventListener('keyup',doKeyUp,true);
        }
    };
};

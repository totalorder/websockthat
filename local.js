var shared = require("./shared.js");
var world = require("./world.js");
var input = require("./input.js");

(function () { // Don't pollute the global namespace

    // Set up settings for the local player
    var localPlayerSettings = [
        {name : 'anton',
         keys : {
            left : 37,
            right : 40,
            start : 32}
        },
        {name : 'enemy',
        keys : {
            left : 77,
            right : 188,
            start : 0}
        }

    ];

    // Set up an InputHandler that will listen for and react to all incoming data that is about the in-game
    // action
    var clientInputHandler = shared.LocalInputHandler();

    var gameStarted = false;

    //onPlayersPacket, inputHandler_onTick
    var onGameOver = function () {
        console.log("GAME OVER!");
        clientWorld.gameOver();
        gameStarted = false;
    };
    var localOutputHandler = shared.LocalOutputHandler(clientInputHandler.onTickReceived, onGameOver);
    var clientWorld = null;

    //webSocket.registerReceivedPacketCallback(shared.PACKET_TYPES.START_DATA, function (packet) { return packet }, function (packet) {

    // Create a new World passing along the game-options received from the server
    // Passing in our ClientInputHandler will let the World notify it when the game starts and what
    // players will be in the game. The InputHandler will then be able to input data directly into
    // the players


    clientWorld = new world.World(clientInputHandler, localOutputHandler, shared.createDefaultOptions(), true);

    // Set up an InputDevice that will listen to the keys pressed by the user and react to them
    // Passing along specialKeyCommandsCallback that will send a START packet to the server when
    // the InputDevice detects the START-input-event
    var player_datas = [];

    for (var i = 0; i < localPlayerSettings.length; i++) {
        var localPlayerSetting = localPlayerSettings[i];
        var input_device = new input.LocalInputDevice(localPlayerSetting.keys, function (command) {
            if (command == input.COMMANDS.START) {
                // Start the game, giving it a list of player_data-objects
                if(!gameStarted) {
                    clientWorld.startGame(player_datas);
                    console.log("started!");
                    gameStarted = true;
                }
            }
        });
        var localInputHandler = input.LocalInputHandler();
        var player_data = {
            id: i,
            name : localPlayerSetting.name,
            input_handler : localInputHandler,
            input_device : input_device
        };

        player_datas.push(player_data);
    }

    // We're all set up. Wait for our player (and all other players) to press start, and let the game begin!
    console.log("PRESS START!");
})();


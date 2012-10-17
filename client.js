var shared = require("./shared.js");
var world = require("./world.js");
var input = require("./input.js");

var ws = new window.WebSocket('ws://127.0.0.1:8006');

var client_player = {name : 'anton', keys : { left : 37, right : 40, start : 32}};

shared.addWebSocketObjectSupport(ws);

console.log("waiting for connection open");
ws.onopen = function() {
    ws.sendObject(shared.createHelloPacket(client_player.name));

    var input_device = new input.LocalInputDevice(client_player.keys, function (command) {
        if (command == input.COMMANDS.START) {
            ws.sendObject(shared.createStartPacket());
            console.log("waiting for players packet!");
        }
    });

    ws.registerReceivedPacketCallback(shared.PACKET_TYPES.START_DATA, function (packet) { return packet }, function (packet) {
        var clientInputHandler = shared.ClientInputHandler(ws);
        var clientWorld = new world.World(clientInputHandler, null, packet.options);

        for (var i = 0; i < packet.players.length; i++) {
            var player_data = packet.players[i];
            if(player_data.you) {
                player_data.input_device = input_device;
                player_data.input_handler = new input.RemoteWSInputHandler(ws);
            }
        }

        clientWorld.startGame(packet.players);
        console.log("started!");
    });

    console.log("PRESS START!");
};


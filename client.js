var shared = require("./shared.js");

var ws = new window.WebSocket('ws://127.0.0.1:8006');

var client_player = {name : 'anton', keys : { left : 37, right : 40}};

shared.addWebSocketObjectSupport(ws);

ws.onopen = function() {
    ws.sendObject(shared.createHelloPacket(client_player.name));
    var clientWorld = new ClientWorld(ws, client_player.keys);

    //ws.registerReceivedPacketCallback(shared.PACKET_TYPES.)
    ws.registerReceivedPacketCallback(shared.PACKET_TYPES.PLAYERS, function (packet) { return packet }, function (packet) {
        clientWorld.startGame(packet.players, ws);
        console.log("started!");
    });

    ws.sendObject(shared.createStartPacket());
    console.log("waiting for players packet!");
};


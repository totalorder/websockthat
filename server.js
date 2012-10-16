var WebSocketServer = require('ws').Server,
    shared = require('./shared.js'),
    world = require('./world.js'),
    input = require('./input.js');
    player = require('./player.js');

(function(exports){
    exports.Server = function () {
        exports.registerPlayerInputCallback = function (player_id, callback) {
            if (!playerInputCallbacks[player_id]) {
                playerInputCallbacks[player_id] = [];
            }
            playerInputCallbacks[player_id].push(callback);
        };

        var wss = new WebSocketServer({port: 8006});
        var playerInputCallbacks = {};
        var outputHandler = shared.ServerOutputHandler();
        var clients = [];
        var theWorld = world.World(outputHandler);

        var nextClientID = 0;
        wss.on('connection', function(ws) {
            console.log("got connection!");
            ws.client_id = nextClientID;
            outputHandler.addClientWS(ws);
            nextClientID++;
            ws.on('message', function(message) {
                //console.log('received: %s', message);
            });

            shared.addWebSocketObjectSupport(ws);
            clients.push(ws);
            ws.onobject = function (packet) {
                if (packet.type == shared.PACKET_TYPES.HELLO) {
                    console.log("received HELLO from player", packet.name);
                    //var new_player = player.Player(ws.client_id, packet.name);

                    ws.player_data = {id: ws.client_id, name : packet.name};

                    //ws.input = ws_input;

                    //exports.registerPlayerInputCallback(ws.client_id, ws_input.onInputCallback);
                }

                /*
                if (packet.type == shared.PACKET_TYPES.INPUT) {
                    if(playerInputCallbacks[ws.client_id]) {
                        for (var i = 0; i < playerInputCallbacks[ws.client_id].length; i++) {
                            var inputCallback = playerInputCallbacks[ws.client_id][i];
                            inputCallback(packet.command);
                        }
                    }
                }*/
                //ws.sendObject(packet);
            };

            ws.registerReceivedPacketCallback(shared.PACKET_TYPES.START, function (packet) { return packet }, function (packet) {
                console.log("received START from player", ws.player_data.name);
                var ws_input = input.WSInputDevice();
                ws.registerReceivedPacketCallback(shared.PACKET_TYPES.INPUT, function (packet) { return packet.command; }, ws_input.onInputCallback);
                ws.player_data.input = ws_input;

                ws.start = true;
                var allStarted = true;
                for (var i = 0; i < clients.length; i++) {
                    var client = clients[i];
                    if (!client.start) {
                        allStarted = false;
                    }
                }

                if (allStarted) {

                    var player_infos = [];
                    var player_datas = [];
                    for (i = 0; i < clients.length; i++) {
                        client = clients[i];
                        var player_info = {id: client.player_data.id, name : client.player_data.name };
                        player_infos.push(player_info);
                        player_datas.push(client.player_data);
                    }

                    console.log("got START from all players, sending players: ", player_infos);
                    var players_packet = shared.createPlayersPacket(player_infos);
                    outputHandler.sendPacketToAllClients(players_packet, function (client_id, packet) {
                        for (var i = 0; i < packet.players.length; i++) {
                            var player_data = packet.players[i];
                            if (client_id == player_data.id) {
                                player_data.you = true;
                            } else {
                                player_data.you = false;
                            }
                        }
                        return packet;
                    });


                    theWorld.startGame(player_datas);
                }
            });
        });
    }
})(typeof exports === 'undefined'? this['server']={}: exports);

var server = require('./server.js');
var s = server.Server();
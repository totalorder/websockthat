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
        var address = {host: '127.0.0.1', port: 8006};
        var wss = new WebSocketServer(address);
        console.log("listening to ", address);
        var playerInputCallbacks = {};
        var outputHandler = shared.ServerOutputHandler();
        var clients = [];
        var options = shared.createDefaultOptions();
        var theWorld = world.World(null, outputHandler, options);
        var gameRunning = false;
        var nextClientID = 0;
        wss.on('connection', function(ws) {
            console.log("got connection!");
            ws.client_id = nextClientID;
            outputHandler.addClientWS(ws);
            nextClientID++;

            shared.addWebSocketObjectSupport(ws);
            clients.push(ws);
            ws.onobject = function (packet) {
                if (packet.type == shared.PACKET_TYPES.HELLO) {
                    console.log("received HELLO from player", packet.name);
                    ws.player_data = {id: ws.client_id, name : packet.name};
                }
            };

            ws.registerReceivedPacketCallback(shared.PACKET_TYPES.START, function (packet) { return packet }, function (packet) {
                if (gameRunning) {
                    return null;
                }
                console.log("received START from player", ws.player_data.name);
                var ws_input_device = input.WSInputDevice();
                var local_input_handler = input.LocalInputHandler();
                ws.registerReceivedPacketCallback(shared.PACKET_TYPES.INPUT, function (packet) { return packet.command; }, ws_input_device.onInputCallback);
                ws.player_data.input_device = ws_input_device;
                ws.player_data.input_handler = local_input_handler;
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

                    theWorld.startGame(player_datas, function () {
                        for (var i = 0; i < clients.length; i++) {
                            clients[i].start = false;
                        }
                        gameRunning = false;
                    });
                    gameRunning = true;
                }
            });
        });
    }
})(typeof exports === 'undefined'? this['server']={}: exports);

var server = require('./server.js');
var s = server.Server();
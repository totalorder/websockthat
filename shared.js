(function(exports){
    exports.addWebSocketObjectSupport = function (webSocket) {
        webSocket.sendObject = function (obj) {
            var json_string = JSON.stringify(obj);
            if (obj.type != 'TICK') {
                console.log("sending: ", json_string);
            }
            webSocket.send(json_string);
        };

        var existing_onmessage = webSocket.onmessage;
        var packetCallbacks = {};

        var _executePacketCallbacks = function (packet) {
            if(packetCallbacks[packet.type]) {
                for (var i = 0; i < packetCallbacks[packet.type].length; i++) {
                    var packetCallback = packetCallbacks[packet.type][i];
                    var validator_result = packetCallback.validator(packet);
                    if (validator_result) {
                        packetCallback.callback(validator_result);
                    }
                }
            }
        };

        webSocket.onmessage = function (message) {
            if (existing_onmessage) {
                existing_onmessage(message);
            }
            if (message.data) {

                var recevied_packet = JSON.parse(message.data);
                if (webSocket.onobject) {
                    webSocket.onobject(recevied_packet);
                }

                _executePacketCallbacks(recevied_packet);
            } else {
                console.log("no data received: ");
                console.log(message);
                webSocket.onobject(null);
            }
        };




        webSocket.registerReceivedPacketCallback = function (packet_type, validator, callback) {
            if (!packetCallbacks[packet_type]) {
                packetCallbacks[packet_type] = [];
            }
            packetCallbacks[packet_type].push({validator: validator, callback: callback});
        };


    };
    exports.PACKET_TYPES = {
        TICK : 'TICK',
        INPUT : 'INPUT',
        START : 'START',
        HELLO : 'HELLO',
        START_DATA : 'START_DATA'
    };

    exports.createPacket = function () {
        return {};
    };

    exports.createTickPacket = function (tick_number) {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.TICK;
        packet.tick_number = tick_number;
        packet.players = {};
        return packet;
    };

    exports.addTrailToTickPacket = function (tick_packet, player_id, trail_point) {
        if(tick_packet.players[player_id] == undefined) {
            tick_packet.players[player_id] = [];
        }
        tick_packet.players[player_id] = trail_point;
    };

    exports.createInputPacket = function (command) {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.INPUT;
        packet.command = command;
        return packet;
    };

    exports.createStartDataPacket = function (options, players) {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.START_DATA;
        packet.players = players;
        packet.options = options;
        return packet;
    };

    exports.createHelloPacket = function (name) {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.HELLO;
        packet.name = name;
        return packet;
    };

    exports.createStartPacket = function () {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.START;
        return packet;
    };

    exports.ServerOutputHandler = function () {
        var tick_packet = null;
        var clients = [];
        var sendPacketToAllClients = function (packet, preprocessor) {
            if (packet.type != exports.PACKET_TYPES.TICK) {
                console.log("sending packet to all clients", packet);
            }
            for (var i = 0; i < clients.length; i++) {
                var client = clients[i];
                if (preprocessor) {
                    packet = preprocessor(client.client_id, packet);
                }

                client.sendObject(packet);
            }
        };

        return {
            addTrailPoint : function (player_id, trail_point) {
                exports.addTrailToTickPacket(tick_packet, player_id, trail_point);
            },

            newTick : function (tick_id) {
                if(tick_packet) {
                    sendPacketToAllClients(tick_packet);
                }
                tick_packet = exports.createTickPacket(tick_id);
            },

            addClientWS : function (ws) {
                clients.push(ws);
            },

            sendPacketToAllClients : sendPacketToAllClients
        };
    };

    exports.ClientInputHandler = function (webSocket) {
        var _players = null;
        var onTickReceived = function (packet) {
            //console.log("ClientInputHandler got TICK ", packet);
            for (var i = 0; i < _players.length; i++) {
                var player = _players[i];
                if (packet.players[player.id]) {
                    //console.log("got TICK ", player.id);
                    player.addTrailPoint(packet.players[player.id]);
                }
            }
        };

        return {
            start : function (players) {
                _players = players;
                webSocket.registerReceivedPacketCallback(exports.PACKET_TYPES.TICK, function (packet) { return packet }, onTickReceived);
            }
        };
    };

    exports.createDefaultOptions = function () {
        return {
            // The desired number of ticks per second
            DESIRED_TPS : 20,
            MAX_TICKS : 350,
            TURNING_SPEED : 10,
            MOVEMENT_SPEED : 10,
            LINE_SIZE : 3,
            GAME_WIDTH : 200,
            GAME_HEIGHT : 200
        };
    };
})(typeof exports === 'undefined'? this['shared']={}: exports);


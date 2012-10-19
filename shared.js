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
        START_DATA : 'START_DATA',
        GAME_OVER : 'GAME_OVER'
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

    exports.createGameOverPacket = function () {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.GAME_OVER;
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
        var tick_packet = exports.createTickPacket(0);;
        var client_datas = [];
        var sendPacketToAllClients = function (packet, preprocessor) {
            if (packet.type != exports.PACKET_TYPES.TICK) {
                console.log("sending packet to all clients", packet);
            }
            for (var i = 0; i < client_datas.length; i++) {
                var client_data = client_datas[i];
                if (preprocessor) {
                    packet = preprocessor(client_data.id, packet);
                }

                client_data.webSocket.sendObject(packet);
            }
        };

        var startGame = function (options, player_infos) {
            var players_packet = exports.createStartDataPacket(options, player_infos);
            sendPacketToAllClients(players_packet, function (client_id, packet) {
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
        };

        return {
            addTrailPoint : function (player_id, trail_point) {
                exports.addTrailToTickPacket(tick_packet, player_id, trail_point);
            },

            tickEnded : function (tick_id) {
                sendPacketToAllClients(tick_packet);
                tick_packet = exports.createTickPacket(tick_id);
            },

            addClient : function (client_data) {
                client_datas.push(client_data);
            },

            gameOver : function () {
                sendPacketToAllClients(exports.createGameOverPacket());
            },

            startGame : startGame
        };
    };

    exports.ClientInputHandler = function (webSocket) {
        var _players = null;
        var _started = false;
        var _callbackRegistered = false;
        var onTickReceived = function (packet) {
            if (!_started) {
                return;
            }
            //console.log("ClientInputHandler got TICK ", packet);
            for (var i = 0; i < _players.length; i++) {
                var player = _players[i];
                if (packet.players[player.id]) {
                    //console.log("got TICK ", player.id);
                    player.addTrailPoint(packet.players[player.id]);
                }
            }
        };

        var onInputReceived = function (player_id, command) {
            _simulator.addInput(player_id, command);
        };


        return {
            start : function (players) {
                _started = true;
                _players = players;
                if(!_callbackRegistered) {
                    webSocket.registerReceivedPacketCallback(exports.PACKET_TYPES.TICK, function (packet) { return packet }, onTickReceived);
                }
                _callbackRegistered = true;

            },

            stop : function () {
                _started = false;
            }
        };
    };

    /**
     * An input handler that sends all incoming commands over a websocket to a remote server
     * @param webSocket
     */
    exports.RemoteWSInputHandler = function (webSocket) {
        var _started = false;
        var player = null;

        return {
            /**
             * Enable the setCommand trigger
             * @param the_player - Never used. Just obeying the interface of an InputHandler
             * @param player_setCommand_ - Never used. Just obeying the interface of an InputHandler
             */
            start : function (the_player, player_setCommand_) {
                if (_started) {
                    player = the_player;
                    _started = true;
                }
            },

            onInputReceived : function (player_id, command) {
                webSocket.sendObject(exports.createInputPacket(command));
            }
        };
    };

    exports.LocalOutputHandler = function (inputHandler_onTick, onGameOver) {
        var tick_packet = exports.createTickPacket(0);
        var startGame = function (options, player_infos) {
        };

        return {
            addTrailPoint : function (player_id, trail_point) {
                exports.addTrailToTickPacket(tick_packet, player_id, trail_point);
            },

            tickEnded : function (tick_id) {
                inputHandler_onTick(tick_packet);
                tick_packet = exports.createTickPacket(tick_id);
            },

            addClient : function (client_data) {
            },

            gameOver : function () {
                onGameOver();
            },

            startGame : startGame
        };
    };

    exports.LocalInputHandler = function () {
        var _players = null;
        var _started = false;
        var _callbackRegistered = false;
        var _simulator = null;

        var onTickReceived = function (packet) {
            if (!_started) {
                return;
            }

            for (var i = 0; i < _players.length; i++) {
                var player = _players[i];
                if (packet.players[player.id]) {
                    player.addTrailPoint(packet.players[player.id]);
                }
            }
        };

        var onInputReceived = function (player_id, command) {
            _simulator.addInput(player_id, command);
        };

        return {
            start : function (players, simulator) {
                _started = true;
                _simulator = simulator;
                _players = players;
                _callbackRegistered = true;
            },

            stop : function () {
                _started = false;
            },

            gameOver : function () {},

            onTickReceived : onTickReceived,
            onInputReceived : onInputReceived
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

    exports.getColorForID = function (id) {
        return {
            0 : "orange",
            1 : "green",
            2 : "purple",
            3 : "cyan",
            4: "red",
            5: "blue"
        }[id];
    };
})(typeof exports === 'undefined'? this['shared']={}: exports);


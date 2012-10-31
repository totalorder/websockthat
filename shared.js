var _ = require('underscore')._;

(function(exports){
    exports.addWebSocketObjectSupport = function (webSocket) {
        var onSendErrorCallback = null,
            existing_onmessage = webSocket.onmessage,
            packet_callbacks = {},
            _next_packet_callback_handler_id = 0,

            _executePacketCallbacks = function (packet) {
                if(packet_callbacks[packet.type]) {
                    _.each(packet_callbacks[packet.type], function (packet_callback) {
                        var validator_result = packet;
                        if (packet_callback.validator !== null) {
                            validator_result = packet_callback.validator(packet);
                        }
                        if (validator_result) {
                            packet_callback.callback(validator_result);
                        }
                    });
                }
        };

        webSocket.sendObject = function (obj) {
            var json_string = JSON.stringify(obj);
            if (obj.type !== 'TICK') {
                console.log("sending: ", json_string);
            }
            try {
                webSocket.send(json_string);
            } catch (e) {
                if (onSendErrorCallback) {
                    onSendErrorCallback(e.toString());
                } else {
                    throw e;
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

        webSocket.setOnSendErrorCallback = function (callback) {
            onSendErrorCallback = callback;
        };




        webSocket.registerReceivedPacketCallback = function (packet_type, validator, callback) {
            var _handler_id = _next_packet_callback_handler_id;
            _next_packet_callback_handler_id += 1;
            if (!packet_callbacks[packet_type]) {
                packet_callbacks[packet_type] = [];
            }

            packet_callbacks[packet_type].push({validator: validator, callback: callback, handler_id: _handler_id});
            return _handler_id;
        };

        webSocket.unregisterReceivedPacketCallback = function (handlerID) {
            var _found_it = false;
            _.some(packet_callbacks, function (callbacks, packetType) {
                _.some(callbacks, function (callback, index) {
                    if(callback.handler_id === handlerID) {
                        _found_it = true;
                        packet_callbacks[packetType].splice(index, 1);

                        // Break out of the loop
                        return true; // Simulate a "break;"
                    }
                });
                if(_found_it) {
                    // Break out of the loop
                    return true; // Simulate a "break;"
                }
            });

            if(!_found_it) {
                throw "handler with ID " + handlerID + " not registered!";
            }
        };


    };
    exports.PACKET_TYPES = {
        TICK : 'TICK',
        INPUT : 'INPUT',
        START : 'START',
        HELLO : 'HELLO',
        START_DATA : 'START_DATA',
        GAME_OVER : 'GAME_OVER',
        LOBBY_STATE : 'LOBBY_STATE'
    };

    exports.createPacket = function () {
        return {};
    };

    exports.createTickPacket = function (tick_number, tps_text) {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.TICK;
        packet.tick_number = tick_number;
        packet.players = {};
        packet.tps_text = tps_text;
        return packet;
    };

    exports.createLobbyStatePacket = function (min_players, max_players, connected_players, players_ready, player_infos) {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.LOBBY_STATE;
        packet.min_players = max_players;
        packet.max_players = max_players;
        packet.connected_players = connected_players;
        packet.players_ready = players_ready;
        packet.player_infos = player_infos;
        return packet;
    };

    exports.createGameOverPacket = function () {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.GAME_OVER;
        return packet;
    };

    exports.setTickPacketPlayerData = function (tick_packet, player_id, data) {
        tick_packet.players[player_id] = data;
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

    exports.WebSocketTickSender = function () {
        var tick_packet = exports.createTickPacket(0, ""),
            client_datas = [],

            sendPacketToAllClients = function (packet, preprocessor) {
                if (packet.type !== exports.PACKET_TYPES.TICK) {
                    console.log("sending packet to all clients", packet);
                }

                _.each(client_datas, function (client_data) {
                    if (preprocessor) {
                        packet = preprocessor(client_data.id, packet);
                    }

                    client_data.webSocket.sendObject(packet);
                });
            },

            startGame = function (options, player_infos) {
                var players_packet = exports.createStartDataPacket(options, player_infos);
                sendPacketToAllClients(players_packet, function (client_id, packet) {
                    _.each(packet.players, function (player_data) {
                        player_data.you = client_id === player_data.id;
                    });
                    return packet;
                });
        };

        return {
            setPlayerData : function (player_id, trail_point) {
                exports.setTickPacketPlayerData(tick_packet, player_id, trail_point);
            },

            getTickPacket : function () {
                return tick_packet;
            },

            getTickPacketPlayerData : function (player_id) {
                if(tick_packet.players[player_id] === undefined) {
                    tick_packet.players[player_id] = {};
                }
                return tick_packet.players[player_id];
            },

            tickEnded : function (tick_id, tps_text) {
                sendPacketToAllClients(tick_packet);
                tick_packet = exports.createTickPacket(tick_id, tps_text);
            },

            addClient : function (client_data) {
                client_datas.push(client_data);
            },

            removeClient : function (client_id) {
                _.some(client_datas, function (client_data, index) {
                    if(client_data.id === client_id) {
                        client_datas.splice(index, 1);
                        return true; // Simulate a "break;";
                    }
                });
            },

            gameOver : function () {
                sendPacketToAllClients(exports.createGameOverPacket());
            },

            startGame : startGame
        };
    };

    exports.WebSocketTickReceiver = function (webSocket) {
        var _started = false,
            _callback_registered = false,
            _simulator,
            _TPSTextCallback = null,

            onTickReceived = function (packet) {
                if (!_started) {
                    return;
                }

                if (_TPSTextCallback) {
                    _TPSTextCallback(packet.tps_text);
                }
                _simulator.receiveExternalUpdate(packet);
        };

        return {
            start : function (simulator, TPSTextCallback) {
                _simulator = simulator;
                _started = true;
                _TPSTextCallback = TPSTextCallback;
                if(!_callback_registered) {
                    webSocket.registerReceivedPacketCallback(exports.PACKET_TYPES.TICK, null, onTickReceived);
                }
                _callback_registered = true;

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
    exports.WebSocketInputSender = function (webSocket) {
        var _started = false,
            player = null;

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
        var tick_packet = exports.createTickPacket(0, ""),
            startGame = function (options, player_infos) {
        };

        return {
            setPlayerData : function (player_id, trail_point) {
                exports.setTickPacketPlayerData(tick_packet, player_id, trail_point);
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

            getTickPacket : function () {
                return tick_packet;
            },

            getTickPacketPlayerData : function (player_id) {
                if(tick_packet.players[player_id] === undefined) {
                    tick_packet.players[player_id] = {};
                }
                return tick_packet.players[player_id];
            },

            startGame : startGame
        };
    };

    exports.getColorForID = function (id) {
        var colors = {
            0 : "orange",
            1 : "green",
            2 : "purple",
            3 : "cyan",
            4: "red",
            5: "blue"
        };
        return colors[id % _.keys(colors).length];
    };
})(typeof exports === 'undefined'? this['shared']={}: exports);


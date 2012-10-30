var _ = require('underscore')._;

(function(exports){
    exports.addWebSocketObjectSupport = function (webSocket) {
        var onSendErrorCallback = null;
        webSocket.sendObject = function (obj) {
            var json_string = JSON.stringify(obj);
            if (obj.type != 'TICK') {
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

        var existing_onmessage = webSocket.onmessage;
        var packetCallbacks = {};
        var _nextPacketCallbackHandlerID = 0;

        var _executePacketCallbacks = function (packet) {
            if(packetCallbacks[packet.type]) {
                for (var i = 0; i < packetCallbacks[packet.type].length; i++) {
                    var packetCallback = packetCallbacks[packet.type][i];
                    var validator_result = packet;
                    if (packetCallback.validator !== null) {
                        validator_result = packetCallback.validator(packet);
                    }
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

        webSocket.setOnSendErrorCallback = function (callback) {
            onSendErrorCallback = callback;
        };




        webSocket.registerReceivedPacketCallback = function (packet_type, validator, callback) {
            var _handlerID = _nextPacketCallbackHandlerID;
            _nextPacketCallbackHandlerID++;
            if (!packetCallbacks[packet_type]) {
                packetCallbacks[packet_type] = [];
            }

            packetCallbacks[packet_type].push({validator: validator, callback: callback, handlerID: _handlerID});
            return _handlerID;
        };

        webSocket.unregisterReceivedPacketCallback = function (handlerID) {
            var _foundIt = false;
            _.each(packetCallbacks, function (callbacks, packetType) {
                _.each(callbacks, function (callback, index) {
                    if(callback.handlerID === handlerID) {
                        _foundIt = true;
                        packetCallbacks[packetType].splice(index, 1);

                        // Break out of the loop
                        return _.breaker;
                    }
                });
                if(_foundIt) {
                    // Break out of the loop
                    return _.breaker;
                }
            });

            if(!_foundIt) {
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

    exports.createTickPacket = function (tick_number) {
        var packet = exports.createPacket();
        packet.type = exports.PACKET_TYPES.TICK;
        packet.tick_number = tick_number;
        packet.players = {};
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

            getTickPacket : function () {
                return tick_packet;
            },

            getTickPacketPlayerData : function (player_id) {
                if(tick_packet.players[player_id] == undefined) {
                    tick_packet.players[player_id] = {};
                }
                return tick_packet.players[player_id];
            },

            tickEnded : function (tick_id) {
                sendPacketToAllClients(tick_packet);
                tick_packet = exports.createTickPacket(tick_id);
            },

            addClient : function (client_data) {
                client_datas.push(client_data);
            },

            removeClient : function (client_id) {
                _.each(client_datas, function (client_data, index) {
                    if(client_data.id === client_id) {
                        client_datas.splice(index, 1);
                        return _.breaker;
                    }
                });
            },

            gameOver : function () {
                sendPacketToAllClients(exports.createGameOverPacket());
            },

            startGame : startGame
        };
    };

    exports.WSReceivingInputHandler = function (webSocket) {
        var _players = null;
        var _started = false;
        var _callbackRegistered = false;
        var _simulator;
        var onTickReceived = function (packet) {
            if (!_started) {
                return;
            }

            console.log("input WSReceivingInputHandler");
            //_simulator.receiveUpdate(packet);

            //console.log("WSReceivingInputHandler got TICK ", packet);
            for (var i = 0; i < _players.length; i++) {
                var player = _players[i];
                if (packet.players[player.id]) {
                    //console.log("got TICK ", player.id);
                    //player.addTrailPoint(packet.players[player.id]);

                    // TODO: Fix this ugliness!
                    if (player.addTrailPoint) {
                        player.addTrailPoint(packet.players[player.id]);
                    } else {
                        player.receiveUpdate(packet.players[player.id]);
                    }
                }
            }
        };

        return {
            start : function (players, simulator) {
                _simulator = simulator;
                _started = true;
                _players = players;
                if(!_callbackRegistered) {
                    webSocket.registerReceivedPacketCallback(exports.PACKET_TYPES.TICK, null, onTickReceived);
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
    exports.WSSendingInputHandler = function (webSocket) {
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
                //console.log("tick_packet", tick_packet);
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
                if(tick_packet.players[player_id] == undefined) {
                    tick_packet.players[player_id] = {};
                }
                return tick_packet.players[player_id];
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

            //_simulator.receiveUpdate(packet);

            for (var i = 0; i < _players.length; i++) {
                var player = _players[i];
                // TODO: Fix this ugliness!
                if (packet.players[player.id]) {
                    if (player.addTrailPoint) {
                        player.addTrailPoint(packet.players[player.id]);
                    } else {
                        player.receiveUpdate(packet.players[player.id]);
                    }
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


/**
 * Library for communicating over WebSocket more easy
 * Enhances the WebSocket-API and exposes senders and receivers for input
 * and tick-data.
 *
 * Exports:
 *  addWebSocketObjectSupport: Enhances a WebSocket instance with utility functions for communicating javascript objects
 *      and packets from the communication-package.
 *      addWebSocketObjectSupport adds the following methods to a WebSocket-instance:
 *          sendObject(obj)
 *          setOnSendErrorCallback(callback)
 *          registerReceivedPacketCallback(packet_type, validator, callback)
 *          unregisterReceivedPacketCallback(handler_id)
 *
 *  createDefaultOptions: Returns the default options for the Game-module
 *  getSimulatorClass: Returns the AchtungSimulator
 */

"use strict";

var _ = require('underscore')._;
var communication = require("./communication.js");

(function(exports){
    /**
     * Adds the following convenience methods to a WebSocket-instance:
     *     sendObject(obj)
     *     setOnSendErrorCallback(callback)
     *     registerReceivedPacketCallback(packet_type, validator, callback)
     *     unregisterReceivedPacketCallback(handler_id)
     *
     * @param web_socket - A WebSocket instance
     */
    exports.addWebSocketObjectSupport = function (web_socket) {
        if (web_socket.object_support) {
            return;
        }
        // The callback to be called if a web_socket.send() throws an exception
        var onSendErrorCallback = null,

            // Save a reference to the existing onmessage-callback
            existing_onmessage = web_socket.onmessage,

            // A dictionary keeping all active packet callbacks
            packet_callbacks = {},

            // A continous increasing series of ids for the registered packet callbacks
            _next_packet_callback_handler_id = 0,

            /**
             * Executes any packet callbacks that are defined for the given packet
             *
             * @param packet - A packet of any type defined in communication.PACKET_TYPES
             */
            _executePacketCallbacks = function (packet) {
                if(packet_callbacks[packet.type]) {
                    // Loop over all callbacks defined for the packets type and
                    // ececute any that returns a truthy value from packet_callback.validator, or har os validator
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

        /**
         * Sends the given javascript-object JSON-encoded over the websocket
         * @param obj - An arbitrary JSON-serializable javascript object
         */
        web_socket.sendObject = function (obj) {
            var json_string = JSON.stringify(obj);

            // Log all sending except tick-packets
            if (obj.type !== 'TICK') {
                console.log("sending: ", json_string);
            }
            try {
                web_socket.send(json_string);

            // Call the onSendErrorCallback on failure
            } catch (e) {
                if (onSendErrorCallback) {
                    onSendErrorCallback(e.toString());
                } else {
                    throw e;
                }
            }
        };

        /**
         *
         * Override the WebSocket.onmessage. After delivering the message to the ordinary WebSocket.onmessage-method,
         * run the JSON-decoded data through any existing packet callbacks and through WebSocket.onobject.
         *
         * @param message - A string received over the WebSocket
         */
        web_socket.onmessage = function (message) {
            // Run the message through any existing onmessage-method
            if (existing_onmessage) {
                existing_onmessage(message);
            }
            if (message.data) {
                // Try to JSON-parse the message and deliver the result to WebSocket.onobject
                var recevied_packet = JSON.parse(message.data);
                if (web_socket.onobject) {
                    web_socket.onobject(recevied_packet);
                }

                // Execute any packet callbacks defined for the recevied packet
                _executePacketCallbacks(recevied_packet);
            } else {
                console.log("no data received: ");
                console.log(message);
                if (web_socket.onobject) {
                    web_socket.onobject(null);
                }
            }
        };

        /**
         * Set the specifiec callback to be called if an exception is thrown when trying to send data
         * on the WebSocket.
         *
         * @param callback - A callback function that should receive a string as only argument
         */
        web_socket.setOnSendErrorCallback = function (callback) {
            onSendErrorCallback = callback;
        };

        /**
         * Register a callback to be called for packets of a specific type and appearance
         * When registering a callback, a packet_type must be specified and if it matches an incoming message,
         * the validator function will be run with the packet as first argument. If the validator returns something
         * truthy, the callback will be called with the return value of the validator as first argument.
         * If the validator returns something falsy the callback will be skipped.
         * If the validator is set to null, the callback will be called with the packet as first argument every time.
         *
         * @param packet_type - Any type defined in communication.PACKET_TYPES
         * @param validator - null or a function that should return something
         * @param callback - The callback to be called if the incoming packet matches the type and validates
         * @return number - The handler ID that should be used to unregister the callback at a later time
         */
        web_socket.registerReceivedPacketCallback = function (packet_type, validator, callback) {
            // Create a new handler_id
            var _handler_id = _next_packet_callback_handler_id;

            // Create an empty list of callbacks for this package type if not defined before
            _next_packet_callback_handler_id += 1;
            if (!packet_callbacks[packet_type]) {
                packet_callbacks[packet_type] = [];
            }

            // Add the callback with its validator, and handler id to the list of packet_callbacks
            packet_callbacks[packet_type].push({validator: validator, callback: callback, handler_id: _handler_id});
            return _handler_id;
        };

        /**
         * Unregister the packet callback with the specified handler ID
         * @param handler_id
         */
        web_socket.unregisterReceivedPacketCallback = function (handler_id) {
            // Loop through all types and and their callback comparing the callback.handler_id to
            // the supplied handler_id.
            // Splice it away if found
            var _found_it = false;
            _.some(packet_callbacks, function (callbacks, packetType) {
                _.some(callbacks, function (callback, index) {
                    if(callback.handler_id === handler_id) {
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

            // Throw an error if not found
            if(!_found_it) {
                throw "handler with ID " + handler_id + " not registered!";
            }
        };
        // Mark the socket as object supported
        web_socket.object_support = true;


    };
    /**
     * A class implementing the TickSender-interface, for delivering tick-packets to all connected clients
     */
    exports.WebSocketTickSender = function () {
        // Create an empty TICK-packet
        var tick_packet = communication.createTickPacket(0, ""),
            // Keep a list for all clients that should receive updates
            client_datas = [],

            /**
             * Send the specified packet to all clients, executing the preprocessor on the individual packets before
             * sending them if a preprocessor is specified. The preprocessor gets access to the individual client ids
             * so that packets can be set up individually
             *
             * @param packet - A communication.PACKET_TYPES.TICK-packet
             * @param preprocessor - A callback that should return a modified version of the packet
             */
            sendPacketToAllClients = function (packet, preprocessor) {
                if (packet.type !== communication.PACKET_TYPES.TICK) {
                    console.log("sending packet to all clients", packet);
                }

                _.each(client_datas, function (client_data) {
                    // Preprocess the packet before sending if a preprocessor is specified
                    if (preprocessor) {
                        packet = preprocessor(client_data.id, packet);
                    }

                    // Send the object on the websocket
                    client_data.web_socket.sendObject(packet);
                });
            },

            /**
             * Send a PACKET_TYPES.START_DATA-packet to all players based on the player_infos delivered
             * by the callee. Setting player_data.you = true for the individual packets that goes out to the clients
             */
            startGame = function (options, player_infos) {
                var players_packet = communication.createStartDataPacket(options, player_infos);
                sendPacketToAllClients(players_packet, function (client_id, packet) {
                    _.each(packet.players, function (player_data) {
                        player_data.you = client_id === player_data.id;
                    });
                    return packet;
                });
            },

            /**
             * Set data for the given player for the current tick
             */
            setPlayerData = function (player_id, data) {
                communication.setTickPacketPlayerData(tick_packet, player_id, data);
            },

            /**
             * Receive a notification that the tick has ended. The tick-packet will be sent off to all clients
             * and a new empty tick-packet will be created
             */
            tickEnded = function (tick_id, tps_text) {
                sendPacketToAllClients(tick_packet, null);
                tick_packet = communication.createTickPacket(tick_id, tps_text);
        };

        return {
            setPlayerData : setPlayerData,

            getTickPacket : function () {
                return tick_packet;
            },

            getTickPacketPlayerData : function (player_id) {
                // Return the player data associated with player_id from the current tick-packet
                if(tick_packet.players[player_id] === undefined) {
                    tick_packet.players[player_id] = {};
                }
                return tick_packet.players[player_id];
            },

            tickEnded : tickEnded,

            addClient : function (client_data) {
                client_datas.push(client_data);
            },

            removeClient : function (client_id) {
                // Splice away the client with the given client_id from the list of client_Datas
                _.some(client_datas, function (client_data, index) {
                    if (client_data.id === client_id) {
                        client_datas.splice(index, 1);
                        return true; // Simulate a "break;";
                    }
                });
            },

            gameOver : function () {
                // Send a GAME_OVER-packet to all connected players
                sendPacketToAllClients(communication.createGameOverPacket(), null);
            },

            startGame : startGame
        };
    };

    /**
     * A class implementing the TickReceiver interface. Receiving TICK-packets from a WebSocket and notifying the
     * simulator
     *
     * @param web_socket - A WebSocket instance
     */
    exports.WebSocketTickReceiver = function (web_socket) {
        var _started = false,

            // Keep track of if we have already registered a packet callback
            _callback_registered = false,

            // The simulator instance that will be supplied in start()
            _simulator = null,

            // The callback to call when TPS-text is received
            _TPSTextCallback = null,

            /**
             * The callback registered for TICK-packets
             * Executes simulator.receiveExternalUpdate with the received packet
             * Also calls TPSTextCallback if present with the tps_text specified in the tick-packet
             *
             * @param packet - A communication.PACKET_TYPES.TICK-packet
             */
            onTickReceived = function (packet) {
                if (!_started) {
                    return;
                }

                if (_TPSTextCallback) {
                    _TPSTextCallback(packet.tps_text);
                }
                _simulator.receiveExternalUpdate(packet);
            },

            /**
             * Register for incoming TICK-packets and notify the simulator when they arrive
             *
             * @param simulator - An instance implementing the Simulator interface
             * @param TPSTextCallback - The callback to be called for received Ticks-per-second-texts
             */
            start = function (simulator, TPSTextCallback) {
                _simulator = simulator;
                _started = true;
                _TPSTextCallback = TPSTextCallback;

                // Register a callback for TICK-packets to onTickReceived if we haven't already
                if(!_callback_registered) {
                    web_socket.registerReceivedPacketCallback(communication.PACKET_TYPES.TICK, null, onTickReceived);
                }
                _callback_registered = true;
        };

        return {
            start : start,

            stop : function () {
                _started = false;
            }
        };
    };

    /**
     * An input sender that sends all incoming commands over a WebSocket to a remote server
     * @param web_socket
     */
    exports.WebSocketInputSender = function (web_socket) {
        var _started = false;

        return {
            /**
             * Enable the setCommand trigger
             * @param the_player - Never used. Just obeying the interface of an InputSender
             * @param player_setCommand_ - Never used. Just obeying the interface of an InputSender
             */
            start : function (the_player, player_setCommand_) {
                if (_started) {
                    _started = true;
                }
            },

            onInputReceived : function (player_id, command) {
                web_socket.sendObject(communication.createInputPacket(command));
            }
        };
    };

    /**
     * An input device that exposes a listener callback onInputCallback
     * which will trigger player.setCommand()
     */
    exports.WebSocketInputReceiver = function (web_socket, player_id) {
        var _started = false,
            _onCommandCallback = null,

            onInputCallback = function (input_command) {
                if (_started) {
                    _onCommandCallback(player_id, input_command);
                }
            };

        return {
            start : function () {
                if (!_started) {
                    // Hook up the InputDevice.onInputCallback to all incoming packets of type INPUT
                    // from the clients websocket
                    web_socket.registerReceivedPacketCallback(communication.PACKET_TYPES.INPUT, function (packet) { return packet.command; }, onInputCallback);
                }

                _started = true;
            },

            onInputCallback : onInputCallback,

            setOnCommandCallback : function (callback) {
                _onCommandCallback = callback;
            }
        };
    };


    /**
     * WARNING: Zombie code associated with the zombie-project in local.js
     */
    exports.LocalOutputHandler = function (inputHandler_onTick, onGameOver) {
        var tick_packet = communication.createTickPacket(0, ""),
            startGame = function (options, player_infos) {
        };

        return {
            setPlayerData : function (player_id, trail_point) {
                communication.setTickPacketPlayerData(tick_packet, player_id, trail_point);
            },

            tickEnded : function (tick_id) {
                inputHandler_onTick(tick_packet);
                tick_packet = communication.createTickPacket(tick_id);
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

})(typeof exports === 'undefined'? this['websocktransport']={}: exports);


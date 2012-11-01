"use strict";

var _ = require('underscore')._;

(function(exports){
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
})(typeof exports === 'undefined'? this['communication']={}: exports);
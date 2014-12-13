if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define([], function() {
    "use strict";

    var PACKET_TYPES = {
        TICK : 'TICK',
        INPUT : 'INPUT',
        START : 'START',
        HELLO : 'HELLO',
        START_DATA : 'START_DATA',
        GAME_OVER : 'GAME_OVER',
        LOBBY_STATE : 'LOBBY_STATE'
    },

    createPacket = function () {
        return {};
    },

    createTickPacket = function (tick_number, tps_text) {
        var packet = createPacket();
        packet.type = PACKET_TYPES.TICK;
        packet.tick_number = tick_number;
        packet.players = {};
        packet.tps_text = tps_text;
        return packet;
    },

    createLobbyStatePacket = function (min_players, max_players, connected_players, players_ready, player_infos, prepare_for_start) {
        var packet = createPacket();
        packet.type = PACKET_TYPES.LOBBY_STATE;
        packet.min_players = max_players;
        packet.max_players = max_players;
        packet.connected_players = connected_players;
        packet.players_ready = players_ready;
        packet.player_infos = player_infos;
        packet.prepare_for_start = prepare_for_start;
        return packet;
    },

    createGameOverPacket = function () {
        var packet = createPacket();
        packet.type = PACKET_TYPES.GAME_OVER;
        return packet;
    },

    setTickPacketPlayerData = function (tick_packet, player_id, data) {
        tick_packet.players[player_id] = data;
    },

    createInputPacket = function (command) {
        var packet = createPacket();
        packet.type = PACKET_TYPES.INPUT;
        packet.command = command;
        return packet;
    },

    createStartDataPacket = function (options, players) {
        var packet = createPacket();
        packet.type = PACKET_TYPES.START_DATA;
        packet.players = players;
        packet.options = options;
        return packet;
    },

    createHelloPacket = function (name) {
        var packet = createPacket();
        packet.type = PACKET_TYPES.HELLO;
        packet.name = name;
        return packet;
    },

    createStartPacket = function () {
        var packet = createPacket();
        packet.type = PACKET_TYPES.START;
        return packet;
    };

    return {
        PACKET_TYPES : PACKET_TYPES,
        createPacket : createPacket,
        createTickPacket : createTickPacket,
        createLobbyStatePacket : createLobbyStatePacket,
        createGameOverPacket : createGameOverPacket,
        setTickPacketPlayerData : setTickPacketPlayerData,
        createInputPacket : createInputPacket,
        createStartDataPacket : createStartDataPacket,
        createHelloPacket : createHelloPacket,
        createStartPacket : createStartPacket
    }
});
"use strict";

var websocktransport = require('../websocktransport.js');

(function (exports) {
    exports.WebSocket = function () {
        var _web_socket = {};
        websocktransport.addWebSocketObjectSupport(_web_socket);
        var onSendErrorCallback;
        _web_socket.send = function () {};
        _web_socket.setOnSendErrorCallback = function (callback) {
            onSendErrorCallback = callback;
        };
        _web_socket.triggerOnSendErrorCallback = function (message) {
            return onSendErrorCallback(message);
        };
        _web_socket.sendObject = function (obj) {
            return null;
        };
        _web_socket.receivePacket = function (packet) {
            _web_socket.onmessage({'data' : JSON.stringify(packet) });
        };
        return _web_socket;
    };

    exports.WebSocketInputReceiver = function () {
        return {
            start : function () {
            },
            setOnCommandCallback : function (callback) {
            }
        };
    };
})(typeof exports === 'undefined'? this['mocks']={}: exports);
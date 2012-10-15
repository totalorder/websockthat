(function(exports){
    exports.addWebSocketObjectSupport = function (webSocket) {
        webSocket.sendObject = function (obj) {
            webSocket.send(JSON.stringify(obj));
        };

        var existing_onmessage = webSocket.onmessage;

        webSocket.onmessage = function (message) {
            if (existing_onmessage) {
                existing_onmessage(message);
            }

            if (webSocket.onobject) {
                if (message.data) {
                    webSocket.onobject(JSON.parse(message.data));
                } else {
                    console.log("data here: ");
                    console.log(message);
                    webSocket.onobject(null);
                }
            }
        };
    };
})(typeof exports === 'undefined'? this['shared']={}: exports);

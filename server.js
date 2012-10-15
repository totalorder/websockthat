var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({port: 8006}),
    shared = require('./shared.js');

wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        console.log('received: %s', message);
    });

    shared.addWebSocketObjectSupport(ws);

    ws.sendObject({"mymsg": "hello!"});
});

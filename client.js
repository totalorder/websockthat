var ws = new window.WebSocket('ws://127.0.0.1:8006');

shared.addWebSocketObjectSupport(ws);
/*ws.onmessage = function(message) {
    console.log('received: %s', message.data);
    console.log(message);
};*/

ws.onobject = function(obj) {
    console.log(obj);
};

ws.onopen = function() {
    ws.send({'some': 'object'});
};
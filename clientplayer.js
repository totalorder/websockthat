var ClientPlayer = function (id, name, settings, webSocket) {
    var _trail = [];

    var setCommand = function (command) {
        webSocket.sendObject(shared.createInputPacket(command));
    };

    var getTrail = function () {
        return _trail;
    };

    var addTrailPoint = function (point) {
        _trail.push(point);
    };

    return {
        setCommand: setCommand,
        getTrail: getTrail,
        addTrailPoint : addTrailPoint,
        id : id
    };
};
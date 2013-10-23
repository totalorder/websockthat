"use strict";

(function (exports) {
    exports.CONFIG = {
        game_package : 'pong',
        start_countdown : 3,
        bind_to_address : '127.0.0.1',
        bind_to_port : 2424,
        connect_to_address : '127.0.0.1',
        connect_to_port : 2424,
        max_players : 2,
        min_players : 2
    };

})(typeof exports === 'undefined'? this['config']={}: exports);
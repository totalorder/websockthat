"use strict";

(function (exports) {
    exports.CONFIG = {
        game_package : 'achtung',
        start_countdown : 3,
        bind_to_address : '192.168.1.7',
        bind_to_port : 2323,
        connect_to_address : '192.168.1.7',
        connect_to_port : 2323,
        max_players : 4,
        min_players : 1
    };

})(typeof exports === 'undefined'? this['config']={}: exports);
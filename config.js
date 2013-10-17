"use strict";

(function(exports){
    exports.CONFIG = {
        game_package : 'achtung',
        start_countdown : 3,
        bind_to_address : '127.0.0.1',
        bind_to_port : 2323,
        connect_to_address : '127.0.0.1',
        connect_to_port : 2323,
        max_players : 4,
        min_players : 1
    };

})(typeof exports === 'undefined'? this['config']={}: exports);
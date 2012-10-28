(function(exports){
    exports.CONFIG = {
        game_package : 'achtung',
        bind_to_address : '127.0.0.1',
        bind_to_port : 2323,
        connect_to_address : '127.0.0.1',
        connect_to_port : 2323
    }

})(typeof exports === 'undefined'? this['config']={}: exports);
"use strict";

(function(exports){
    exports.UI = function (game_area_selector, stats_box_selector, toast_selector, lobby_selector) {
        var game_area, stats_box, toast_box, lobby,
            _init = function () {
                game_area = document.querySelectorAll(game_area_selector)[0];
                stats_box = document.querySelectorAll(stats_box_selector)[0];
                toast_box = document.querySelectorAll(toast_selector)[0];
                lobby = document.querySelectorAll(lobby_selector)[0];

                toast_box.top = game_area.height / 2 - toast_box.height / 2;
                toast_box.left = game_area.width / 2 - toast_box.width / 2;
            },
            _clearStatsBox = function () {
                while (lobby.hasChildNodes()) {
                    lobby.removeChild(lobby.lastChild);
                }
            },
            _addStatsBoxLine = function (line) {
                lobby.appendChild(line);
            },

            _createToast = function (message) {
                toast_box.innerHTML = message;
                toast_box.style.display = "block";
            },

            _hideToast = function () {
                toast_box.style.display = "none";
            },

            _startToastCountdown = function (seconds) {
                _showTimeoutStep(seconds);
            },

            _showTimeoutStep = function (seconds) {
                if (seconds > 0) {
                    _createToast("Starting in " + seconds + "...");
                    seconds -= 1;
                    setTimeout((function (seconds) { return function () { _showTimeoutStep(seconds); }; })(seconds), 1000);
                }
            };

        return {
            clearStatsBox : _clearStatsBox,
            addStatsBoxLine : _addStatsBoxLine,
            createToast : _createToast,
            hideToast : _hideToast,
            startToastCountdown : _startToastCountdown,
            init : _init
        };
    };

})(typeof exports === 'undefined'? this['ui']={}: exports);

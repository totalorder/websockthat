"use strict";

(function(exports){
    exports.UI = function (game_area_selector, stats_box_selector, toast_selector, lobby_selector) {
        var game_area, stats_box, toast_box, lobby, click_callback, last_touch_direction = 0,
            _init = function () {
                game_area = document.querySelectorAll(game_area_selector)[0];
                stats_box = document.querySelectorAll(stats_box_selector)[0];
                toast_box = document.querySelectorAll(toast_selector)[0];
                lobby = document.querySelectorAll(lobby_selector)[0];

                // Add listerens for touch devices
                document.addEventListener('touchmove', _touchMoveCallback);
                document.addEventListener('touchstart', _touchStartCallback);
                document.addEventListener('touchend', _touchEndCallback);

                toast_box.top = game_area.height / 2 - toast_box.height / 2;
                toast_box.left = game_area.width / 2 - toast_box.width / 2;
            },

            // Calculate the average position of all touches and send it to _clickInput
            _touchMoveCallback = function (evt) {
                var totX = 0, totY = 0;
                _.each(evt.touches, function(touchEvt){
                    totX += touchEvt.clientX;
                    totY += touchEvt.clientY;
                });

                _clickInput(totX / evt.touches.length, totY / evt.touches.length);
                evt.preventDefault();
                return false;
            },

            // Translate touch position into -1, 0 or 1, representing left, release, right
            // in click_callback
            _clickInput = function (x, y) {
                var touch_direction;
                if (click_callback !== undefined) {
                    if (x < screen.width / 2.1) {
                        touch_direction = -1;
                    } else if (x > screen.width - screen.width / 2.1) {
                        touch_direction = 1;
                    } else {
                        touch_direction = 0;
                    }
                    if (touch_direction != last_touch_direction) {
                        last_touch_direction = touch_direction;
                        click_callback(touch_direction);
                    }
                }
            },
            _touchEndCallback = function (evt) {
                _clickInput(screen.width / 2, screen.height / 2);
                evt.preventDefault();
                return false;
            },
            _touchStartCallback = function (evt) {
                _clickInput(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);
                evt.preventDefault();
                return false;
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
            },
            _setClickCallback = function (callback) {
                click_callback = callback;
            };

        return {
            clearStatsBox : _clearStatsBox,
            addStatsBoxLine : _addStatsBoxLine,
            createToast : _createToast,
            hideToast : _hideToast,
            startToastCountdown : _startToastCountdown,
            setClickCallback : _setClickCallback,
            init : _init
        };
    };

})(typeof exports === 'undefined'? this['ui']={}: exports);

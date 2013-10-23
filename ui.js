"use strict";
var _ = require('underscore')._;

(function (exports) {
    exports.UI = function (game_area_selector, canvas_selector, stats_box_selector, toast_selector, lobby_selector,
                           keyinfo_boxes_selector) {
        var game_area, stats_box, toast_box, lobby, click_callback, last_touch_direction = 0, canvas, keyinfo_boxes,
            _init = function () {
                game_area = document.querySelectorAll(game_area_selector)[0];
                stats_box = document.querySelectorAll(stats_box_selector)[0];
                toast_box = document.querySelectorAll(toast_selector)[0];
                lobby = document.querySelectorAll(lobby_selector)[0];
                canvas = document.querySelectorAll(canvas_selector)[0];
                keyinfo_boxes = document.querySelectorAll(keyinfo_boxes_selector);

                // Add listeners for touch devices
                document.addEventListener('touchmove', _touchMoveCallback);
                document.addEventListener('touchstart', _touchStartCallback);
                document.addEventListener('touchend', _touchEndCallback);

                toast_box.top = game_area.height / 2 - toast_box.height / 2;
                toast_box.left = game_area.width / 2 - toast_box.width / 2;

                // Hack to make the height of the canvas the same as the width, on browsers that doesn't accept
                // the CSS-hack in .canvas-resize-dummy
                if (canvas.offsetHeight === 0) {
                    canvas.style.height = canvas.offsetWidth + "px";
                    window.addEventListener('resize', function (evt) {
                        canvas.style.height = canvas.offsetWidth + "px";
                    });
                }
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
                    if (x < window.outerWidth / 2.1) {
                        touch_direction = -1;
                    } else if (x > window.outerWidth - window.outerWidth / 2.1) {
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
            // Send a middle-of-the-screen click when a release is triggered.
            // Resulting in a 0/release in _clickInput
            _touchEndCallback = function (evt) {
                _clickInput(window.outerWidth / 2, window.outerWidth / 2);
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

            _createToast = function (message, submessage) {
                toast_box.innerHTML = message;
                toast_box.style.display = "block";
                if (submessage) {
                    var submessage_div = document.createElement("div");
                    submessage_div.innerHTML = submessage;
                    submessage_div.className = "submessage";
                    toast_box.appendChild(submessage_div);
                }
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
            },

            _hideKeyinfoBox = function () {
                _.each(keyinfo_boxes, function (keyinfo_box) {
                    if (!keyinfo_box.className.indexOf("hide") >= 0) {
                        keyinfo_box.className += " hide";
                    }
                });
            };

        return {
            clearStatsBox : _clearStatsBox,
            addStatsBoxLine : _addStatsBoxLine,
            createToast : _createToast,
            hideToast : _hideToast,
            startToastCountdown : _startToastCountdown,
            setClickCallback : _setClickCallback,
            hideKeyinfoBox : _hideKeyinfoBox,
            init : _init
        };
    };

})(typeof exports === 'undefined'? this['ui']={}: exports);

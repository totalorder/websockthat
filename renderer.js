"use strict";

var _ = require('underscore')._;

/**
 * Rendering engine for Websockthat
 *
 */

/**
 * var element_id the id of the canvas element in the webpage
 * var width width of the gaming area
 * var height heigth of the gaming area
 *
 */

(function(exports){
    exports.CanvasRenderer = function (element_id, settings, world, simulator) {

        var desired_FPS = 25, // The disired frames per second
            desired_redraw_interval = 1000 / desired_FPS, // The desired redraw interval to keep the desired FPS
            redraw_interval = desired_redraw_interval, // The current redraw interval
            redraw_start_time = new Date().getTime(), // The time the last redraw started
            frame_render_time = 100, // The time it took to render the last frame

            width = settings.GAME_WIDTH,
            height = settings.GAME_HEIGHT,

            // DOM elements for text output
            FPS_span = document.getElementById('frame_duration'),
            TPS_span = document.getElementById('tick_duration'),
            debug_div = document.getElementById('debug_message'),
            log_div = document.getElementById('log'),

            players = [],
            canvas = document.getElementById(element_id),


            ctx = canvas.getContext("2d"),
            debug_message = "",

            canvas_size = {
                width: width,
                height: height
            },

            running = false,

            _init = function () {
                console.log("drawing on canvas", canvas);

                canvas.setAttribute("width", width);
                canvas.setAttribute("height", height);

                ctx.lineWidth = settings.LINE_SIZE * 2;
                ctx.strokeStyle="rgb(0,0,0)";
            },



            redrawLoop = function () {
                // Draws to the canvas at a given frames per second, slowing down FPS if rendering is too slow
                // Will keep on looping forever

                // Record the time when the redraw starts to measure execution time
                redraw_start_time = new Date().getTime();

                //console.log(world);

                // Draw debug/log/performance data in DOM
                FPS_span.innerHTML = 1000 / redraw_interval;
                TPS_span.innerHTML = world.getTicksPerSecondText();
                log_div.innerHTML = world.getLogData().substr(0,2048);
                debug_div.innerHTML = debug_message;

                // Do the actual redrawing of the screen
                _redraw();
                frame_render_time = new Date().getTime() - redraw_start_time;

                // Lower the rendering speed if the desired rendering time is faster than it's possible to render a frame
                if (frame_render_time > desired_redraw_interval) {
                    redraw_interval = frame_render_time * 1.5;
                } else {
                    redraw_interval = desired_redraw_interval;
                }

                if(running) {
                    // Re-run the rendering loop
                    setTimeout(redrawLoop, redraw_interval);
                } else {
                    console.log("stopping rendering engine");
                }
            },

            _redraw = function () {
                // Redraw the screen

                // Get the ratio (0 > r > 1) of the tick duration
                // Representing how big part of the tick that has elapsed

                var tick_duration_ratio = world.getTickDurationRatio();

                ctx.clearRect(0, 0, canvas_size.width, canvas_size.height);

                ctx.save();
                simulator.draw(ctx);
                ctx.restore();

                _.each(players, function (player) {
                    ctx.save();
                    player.draw(ctx);
                    ctx.restore();
                });
            },

            clear = function () {
                players = [];
            },

            stop = function () {
                running = false;
            },

            start = function () {
                // Start the drawing loop
                // It will continue for ever
                if (!running) {
                    console.log("starting rendering engine");
                    //console.log(world);
                    running = true;
                    redrawLoop();
                }
        };

        _init();

        return {
            getFrameRenderTime : function() {
                return frame_render_time;
            },

            create: function (player) {
                players.push(player);
            },
            clear : clear,

            start: start,
            stop: stop,
            isStub : function () {
                return false;
            }
        };
    };

		exports.SVGRenderer = function(element_id, settings, world) {

			if(typeof Raphael === "undefined") {
				throw new Error("Cannot find Raphael");
			}

            var desired_FPS = 25, // The disired frames per second
                desired_redraw_interval = 1000 / desired_FPS, // The desired redraw interval to keep the desired FPS
                redraw_interval = desired_redraw_interval, // The current redraw interval
                redraw_start_time = new Date().getTime(), // The time the last redraw started
                frame_render_time = 100, // The time it took to render the last frame

                width = settings.GAME_WIDTH,
                height = settings.GAME_HEIGHT,

                // DOM elements for text output
                FPS_span = document.getElementById('frame_duration'),
                TPS_span = document.getElementById('tick_duration'),
                debug_div = document.getElementById('debug_message'),
                log_div = document.getElementById('log'),

                players = [],
                canvas = document.getElementById(element_id),

                paper = Raphael(document.getElementById("svg"), height, width),

                ctx = canvas.getContext("2d"),
                debug_message = "",

                canvas_size = {
                    width: width,
                    height: height
                },

                running = false,

                _init = function () {
                    console.log("drawing on canvas", canvas);

                    canvas.setAttribute("width", width);
                    canvas.setAttribute("height", height);

                    ctx.lineWidth = settings.LINE_SIZE * 2;
                    ctx.strokeStyle="rgb(0,0,0)";
                },



                redrawLoop = function () {
                    // Draws to the canvas at a given frames per second, slowing down FPS if rendering is too slow
                    // Will keep on looping forever

                    // Record the time when the redraw starts to measure execution time
                    redraw_start_time = new Date().getTime();

                    //console.log(world);

                    // Draw debug/log/performance data in DOM
                    FPS_span.innerHTML = 1000 / redraw_interval;
                    TPS_span.innerHTML = world.getTicksPerSecondText();
                    log_div.innerHTML = world.getLogData().substr(0,2048);
                    debug_div.innerHTML = debug_message;

                    // Do the actual redrawing of the screen
                    _redraw();
                    frame_render_time = new Date().getTime() - redraw_start_time;

                    // Lower the rendering speed if the desired rendering time is faster than it's possible to render a frame
                    if (frame_render_time > desired_redraw_interval) {
                        redraw_interval = frame_render_time * 1.5;
                    } else {
                        redraw_interval = desired_redraw_interval;
                    }

                    if(running) {
                        // Re-run the rendering loop
                        setTimeout(redrawLoop, redraw_interval);
                    } else {
                        console.log("stopping rendering engine");
                    }
                },

                _redraw = function () {
                    ctx.clearRect(0, 0, canvas_size.width, canvas_size.height);

                    paper.clear();
                    players.forEach(function(player) {
                        var trail = player.getTrail(),
                            lp = trail.map(function(point, index) {
                            if(index === 0) {
                                return "M" + point.x + "," + point.y;
                            } else {
                                return "L" + point.x + "," + point.y;
                            }
                        });
                        paper.path(lp.join(" "));
                    });
                },

                clear = function () {
                    players = [];
                },

                    stop = function () {
                        running = false;
                    },

                    start = function () {
                        // Start the drawing loop
                        // It will continue for ever
                        if (!running) {
                            console.log("starting rendering engine");
                            //console.log(world);
                            running = true;
                            redrawLoop();
                        }
                    };

                _init();

			return {
				getFrameRenderTime : function() {
					return frame_render_time;
				},

				create: function (player) {
					players.push(player);
				},
				clear : clear,

				start: function() {
					if (!running) {
						console.log("starting rendering engine");
						running = true;
						redrawLoop();
					}

				},
				stop: stop,
				isStub : function () {
					return false;
				}
			};

		};

    exports.StubRenderer = function (element_id, settings, world) {
        return {
            getFrameRenderTime : function() {
                return 0;
            },

            create: function (id, x, y, hp, name) {
            },
            hit: function (id, hp) {
            },
            move: function (id, x, y) {
            },
            look: function (id, direction) {
            },
            shoot: function (id, direction) {
            },
            clear : function () {
            },
            stop : function () {
            },
            start : function () {
                console.log("starting STUB renderer");
            },
            isStub : function () {
                return true;
            }

        };
    };
})(typeof exports === 'undefined'? this['renderer']={}: exports);
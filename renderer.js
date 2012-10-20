/**
 * Rendering engine for Player wars
 *
 */

/**
 * var element_id the id of the canvas element in the webpage
 * var width width of the gaming area
 * var height heigth of the gaming area
 *
 * Returns object with functions: create, hit, move, look and shoot
 */

(function(exports){
    exports.CanvasRenderer = function (element_id, settings, world, simulator) {

        var desiredFPS = 25; // The disired frames per second
        var desiredRedrawInterval = 1000 / desiredFPS; // The desired redraw interval to keep the desired FPS
        var redrawInterval = desiredRedrawInterval; // The current redraw interval
        var redrawStartTime = new Date().getTime(); // The time the last redraw started
        var frameRenderTime = 100; // The time it took to render the last frame

        var width = settings.GAME_WIDTH;
        var height = settings.GAME_HEIGHT;

        // DOM elements for text output
        var FPSSpan = document.getElementById('frame_duration');
        var TPSSpan = document.getElementById('tick_duration');
        var debugDiv = document.getElementById('debug_message');
        var logDiv = document.getElementById('log');

        var players = [];
        var canvas = document.getElementById(element_id);
        console.log("drawing on canvas", canvas);
        var ctx = canvas.getContext("2d");
        var debugMessage = "";

        var canvas_size = {
            width: width,
            height: height
        };

        canvas.setAttribute("width", width);
        canvas.setAttribute("height", height);

        ctx.lineWidth = settings.LINE_SIZE * 2;
        ctx.strokeStyle="rgb(0,0,0)";

        var running = false;

        var redrawLoop = function () {
            // Draws to the canvas at a given frames per second, slowing down FPS if rendering is too slow
            // Will keep on looping forever

            // Record the time when the redraw starts to measure execution time
            redrawStartTime = new Date().getTime();

            //console.log(world);

            // Draw debug/log/performance data in DOM
            FPSSpan.innerHTML = 1000 / redrawInterval;
            TPSSpan.innerHTML = world.getTicksPerSecondText();
            logDiv.innerHTML = world.getLogData().substr(0,2048);
            debugDiv.innerHTML = debugMessage;

            // Do the actual redrawing of the screen
            _redraw();
            frameRenderTime = new Date().getTime() - redrawStartTime;

            // Lower the rendering speed if the desired rendering time is faster than it's possible to render a frame
            if (frameRenderTime > desiredRedrawInterval) {
                redrawInterval = frameRenderTime * 1.5;
            } else {
                redrawInterval = desiredRedrawInterval;
            }

            if(running) {
                // Re-run the rendering loop
                setTimeout(redrawLoop, redrawInterval);
            } else {
                console.log("stopping rendering engine");
            }
        };

        var _redraw = function () {
            // Redraw the screen

            // Get the ratio (0 > r > 1) of the tick duration
            // Representing how big part of the tick that has elapsed

            var tick_duration_ratio = world.getTickDurationRatio();

            ctx.clearRect(0, 0, canvas_size.width, canvas_size.height);

            ctx.save();
            simulator.draw(ctx);
            ctx.restore();

            for (var i = 0; i < players.length; i++) {
                ctx.save();
                players[i].draw(ctx);
                ctx.restore();
                /*
                var trail = players[i].getTrail();
                ctx.fillStyle = players[i].color;
                var lastPoint = false;
                for (var it = 0; it < trail.length; it++) {
                    var point = trail[it];
                    if(false && lastPoint) {
                        ctx.beginPath();
                        ctx.moveTo(lastPoint.x, lastPoint.y);
                        ctx.lineTo(point.x, point.y);
                        ctx.closePath();
                        ctx.stroke();
                    }
                    //ctx.fillRect(Math.floor(point.x),100,10,10);
                    //console.log(point);

                    ctx.beginPath();
                    ctx.arc(point.x, point.y, settings.LINE_SIZE, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.fill();

                    lastPoint = point;
                }*/
            }

        };

        var clear = function () {
            players = [];
        };

        var stop = function () {
            running = false;
        };

        var start = function () {
            // Start the drawing loop
            // It will continue for ever
            if (!running) {
                console.log("starting rendering engine");
                //console.log(world);
                running = true;
                redrawLoop();
            }
        };

        return {
            getFrameRenderTime : function() {
                return frameRenderTime;
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

			var desiredFPS = 25; // The disired frames per second
			var desiredRedrawInterval = 1000 / desiredFPS; // The desired redraw interval to keep the desired FPS
			var redrawInterval = desiredRedrawInterval; // The current redraw interval
			var redrawStartTime = new Date().getTime(); // The time the last redraw started
			var frameRenderTime = 100; // The time it took to render the last frame

			var width = settings.GAME_WIDTH;
			var height = settings.GAME_HEIGHT;

			// DOM elements for text output
			var FPSSpan = document.getElementById('frame_duration');
			var TPSSpan = document.getElementById('tick_duration');
			var debugDiv = document.getElementById('debug_message');
			var logDiv = document.getElementById('log');
			var running = false;
			var players = [];
			//var canvas = document.getElementById(element_id);
			console.log("drawing on canvas", canvas);
			var ctx = canvas.getContext("2d");
			var debugMessage = "";

			var canvas_size = {
				width: width,
				height: height
			};

			var paper = Raphael(document.getElementById("svg"), height, width);


			var clear = function () {
				players = [];
			};
			var stop = function () {
				running = false;
			};

			var redrawLoop = function () {
				// Draws to the canvas at a given frames per second, slowing down FPS if rendering is too slow
				// Will keep on looping forever

				// Record the time when the redraw starts to measure execution time
				redrawStartTime = new Date().getTime();

				//console.log(world);

				// Draw debug/log/performance data in DOM
				FPSSpan.innerHTML = 1000 / redrawInterval;
				TPSSpan.innerHTML = world.getTicksPerSecondText();
				logDiv.innerHTML = world.getLogData().substr(0,2048);
				debugDiv.innerHTML = debugMessage;

				// Do the actual redrawing of the screen
				_redraw();
				frameRenderTime = new Date().getTime() - redrawStartTime;

				// Lower the rendering speed if the desired rendering time is faster than it's possible to render a frame
				if (frameRenderTime > desiredRedrawInterval) {
					redrawInterval = frameRenderTime * 1.5;
				} else {
					redrawInterval = desiredRedrawInterval;
				}

				if(running) {
					// Re-run the rendering loop
					setTimeout(redrawLoop, redrawInterval);
				} else {
					console.log("stopping rendering engine");
				}
			};

			var _redraw = function () {
				ctx.clearRect(0, 0, canvas_size.width, canvas_size.height);

				paper.clear();
				players.forEach(function(player) {
				  var trail = player.getTrail();
					var lp = trail.map(function(point, index) {
						if(index === 0) {
							return "M" + point.x + "," + point.y;
						} else {
							return "L" + point.x + "," + point.y;
						}
					});
					paper.path(lp.join(" "));
				});
			};

			return {
				getFrameRenderTime : function() {
					return frameRenderTime;
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
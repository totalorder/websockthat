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
    exports.CanvasRenderer = function (element_id, settings, world) {

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
        /*var scale = {
            x: canvas_size.width / width,
            y: canvas_size.height / height
        };*/

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

            // Re-run the rendering loop
            setTimeout(redrawLoop, redrawInterval);
        };

        var _redraw = function () {
            // Redraw the screen

            // Get the ratio (0 > r > 1) of the tick duration
            // Representing how big part of the tick that has elapsed

            var tick_duration_ratio = world.getTickDurationRatio();
            //ctx.strokeStyle="rgb(200,200,255)"
            ctx.clearRect(0, 0, canvas_size.width, canvas_size.height);
            for (var i = 0; i < players.length; i++) {
                var trail = players[i].getTrail();
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
                }
            }

            /*
            for (i = 0; i < players.length; i++) {
                trail = players[i].getTrail();
                for (it = 0; it < trail.length; it++) {
                    point = trail[it];
                    //console.log(point.distance);
                    if(point.distance != undefined) {
                        ctx.fillStyle="rgb(" + Math.max(0, 255 - Math.floor(point.distance)) + ",0, 0)";
                    } else {
                        ctx.lineWidth = 1;
                        ctx.fillStyle="rgb(128,128,128)";
                    }

                    ctx.beginPath();
                    ctx.arc(point.x, point.y, settings.LINE_SIZE, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.fill();
                    if(point.distance == undefined) {
                        ctx.stroke();
                    }

                }
            }

            for (i = 0; i < players.length; i++) {
                trail = players[i].getTrail();
                for (it = 0; it < trail.length; it++) {
                    point = trail[it];

                    if(point.crashed) {
                        //ctx.save();
                        ctx.strokeStyle="rgb(0,255,0)";
                        ctx.lineWidth = settings.LINE_SIZE / 2;
                        ctx.beginPath();
                        console.log(point);

                        ctx.moveTo(point.crashed.x, point.crashed.y);
                        ctx.lineTo(point.x, point.y);
                        ctx.closePath();
                        ctx.stroke();
                        throw "asd";
                        //ctx.restore();
                    }

                    lastPoint = point;
                }
            }*/
        };

        var get_player_by_id = function (id) {
            var player = null;
            for (var i = 0; i < players.length; i++) {
                if (players[i].id == id) {
                    return players[i];
                }
            }
            return player;
        };

        return {
            getFrameRenderTime : function() {
                return frameRenderTime;
            },

            newTick : function() {

            },

            create: function (player) {
                players.push(player);
            },
            clear : function () {
                players = [];
            },

            start: function () {
                // Start the drawing loop
                // It will continue for ever
                if (!running) {
                    console.log("starting rendering engine");
                    //console.log(world);
                    running = true;
                    redrawLoop();
                }
            },
            isStub : function () {
                return false;
            }
        };
    };



    exports.StubRenderer = function (element_id) {
        return {
            getFrameRenderTime : function() {
                return 0;
            },

            newTick : function() {
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
            start : function () {
                console.log("starting STUB renderer");
            },
            isStub : function () {
                return true;
            }

        };
    };
})(typeof exports === 'undefined'? this['renderer']={}: exports);
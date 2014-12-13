"use strict";

define(["pixi", "underscore"], function (PIXI, _) {
    var Animation = function (animationSpeed, frames) {
        var currentFrame = 0;
        var getNewFrameTexture = function (dt) {
            var lastFrame = Math.floor(currentFrame);
            currentFrame = (currentFrame + dt * animationSpeed) % frames.length;
            var newFrame = Math.floor(currentFrame);
            if (lastFrame !== newFrame) {
                return frames[newFrame];
            } else {
                return null;
            }
        };

        return {
            getNewFrameTexture: getNewFrameTexture
        }
    };

    var AnimationSet = function (texture, frameWidth, frameHeight, animationsConfig) {
        var animations = {};

        _.forEach(animationsConfig, function(config, animationName) {
            var frames = [];
            for(var i = config.start; i <= config.end; i++) {
                frames.push(new PIXI.Texture(texture, new PIXI.Rectangle(
                    (i % (texture.width / frameWidth)) * frameWidth,
                    Math.floor(i / (texture.width / frameWidth)) * frameHeight, frameWidth, frameHeight)));
            }
            animations[animationName] = new Animation(10, frames);
        });

        return {
            animations: animations
        }
    };

    return {
        'AnimationSet': AnimationSet
    };
});



"use strict";

define(["input", "pixi", "eggsofdoom/animation"], function (input, PIXI, animation) {
    var Player = function (id, x, y, stage) {
        var currentAnimation = 'idle';
        var width = 20;
        var height = 20;
        var getBoundingBox = function() {
            return {
                'x': x - width / 2,
                'y': y - height / 2,
                'x2': x + width / 2,
                'y2': y + height / 2
            };
        };
        var texture = new PIXI.Texture.fromImage("penguin.png");
        var sprite = function() {
            // create a new Sprite using the texture            
            var playerSprite = new PIXI.Sprite(texture);
            // center the sprites anchor point
            playerSprite.anchor.x = 0.5;
            playerSprite.anchor.y = 0.7;
            return playerSprite;
        }();
        var animationSet = function() {                                     
            
            stage.addChild(sprite);
            var playerAnimationSet = new animation.AnimationSet(texture, 40, 40, {'idle': {'start': 0, 'end': 2}});
            
            return playerAnimationSet;
        }();
        var update = function(dt, keysDown, world) {
            var diffY = 0,
                diffX = 0;

            if (keysDown[input.keyMapping.LEFT] && !keysDown[input.keyMapping.RIGHT]) {
                diffY = -100 * dt;
            }
            if (keysDown[input.keyMapping.RIGHT] && !keysDown[input.keyMapping.LEFT]) {
                diffY = 100 * dt;
            }
            if (keysDown[input.keyMapping.UP] && !keysDown[input.keyMapping.DOWN]) {
                diffX = -100 * dt;
            }
            if (keysDown[input.keyMapping.DOWN] && !keysDown[input.keyMapping.UP]) {
                diffX = 100 * dt;
            }

            var newPos = world.move(getBoundingBox(), x, y, diffY, diffX);
            x = newPos.x;
            y = newPos.y;
            sprite.position.x = x;
            sprite.position.y = y;
        };

        var render = function(dt) {
            var animation = animationSet.animations[currentAnimation];
            var newFrameTexture = animation.getNewFrameTexture(dt);
            if (newFrameTexture) {
                sprite.setTexture(newFrameTexture);
            }
        };
        
       

        return {
            'id': id,
            'x': x,
            'y': y,
            'render': render,
            'update': update
        }
    };

    return {
        'Player': Player
    }
});



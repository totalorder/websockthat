"use strict";

define(function () {
    var World = function (map) {
        var collides = function (boundingBox, transpose) {
            return _.some(
                [[boundingBox.x, boundingBox.y],
                 [boundingBox.x2, boundingBox.y],
                 [boundingBox.x2, boundingBox.y2],
                 [boundingBox.x, boundingBox.y2]],
                function (corner) {
                    var transposedCorner = transpose(corner);
                    return !map.getTileAtPosition(transposedCorner[0], transposedCorner[1]).isPassable();
                })
        };

        var move = function(boundingBox, x, y, diffX, diffY) {
            if(!collides(boundingBox, function(corner) {
                return [corner[0] + diffX, corner[1] + diffY]
            })) {
                return {'x': x + diffX, 'y': y + diffY};
            } else if(!collides(boundingBox, function(corner) {
                return [corner[0] + diffX, corner[1]]
            })) {
                return {'x': x + diffX, 'y': y};
            } else if(!collides(boundingBox, function(corner) {
                return [corner[0], corner[1] + diffY]
            })) {
                return {'x': x, 'y': y + diffY};
            } else {
                return {'x': x, 'y': y};
            }
        };

        return {
            'move': move
        }
    };

    return {
        'World': World
    }
});



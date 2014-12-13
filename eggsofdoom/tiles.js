"use strict";

define(function () {
    var Tile = function (tileSize, type, x, y) {
        var initializeRendering = function (PIXI, mapContainer) {
                var sprite;
                switch (type) {
                case 1:
                    sprite = PIXI.Sprite.fromImage("tile_soft.png");
                    break;
                case 2:
                    sprite = PIXI.Sprite.fromImage("tile.png");
                    break;
                case 3:
                    sprite = PIXI.Sprite.fromImage("tile_hard.png");
                    break;
                default:
                    throw "tile type not recognized" + type;
                }
                sprite.x = x * tileSize;
                sprite.y = y * tileSize;
                sprite.width = tileSize;
                sprite.height = tileSize;
                mapContainer.addChild(sprite);
            },
            isPassable = function () {
                return type === 2;
            },
            isDestructable = function () {
                return type === 1;
            };
        return {
            initializeRendering: initializeRendering,
            isPassable: isPassable,
            x: x,
            y: y
        };
    },
        Map = function (mapDesign, mapContainer, tileSize) {
            var map = [],
                tiles = [],
                width,
                height = mapDesign.length,
                rowNum,
                designRow,
                row,
                colNum,
                getTileAtPosition = function (x, y) {
                    return map[Math.floor(y / tileSize)][Math.floor(x / tileSize)];
                },
                initializeRendering = function(PIXI, mapContainer) {
                    _.each(tiles, function(tile) {
                        tile.initializeRendering(PIXI, mapContainer);
                    });
                };
            for (rowNum = 0; rowNum < mapDesign.length; rowNum++) {
                designRow = mapDesign[rowNum];
                row = [];
                width = designRow.length;
                for (colNum = 0; colNum < designRow.length; colNum++) {
                    var tile = new Tile(tileSize, mapDesign[rowNum][colNum], colNum, rowNum);
                    tiles.push(tile);
                    row.push(tile);
                }
                map.push(row);
            }
            return {
                width: width,
                height: height,
                getTileAtPosition : getTileAtPosition,
                initializeRendering: initializeRendering
            };
        };

    return {
        Map: Map
    };
});
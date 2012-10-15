

var numberOfGames = 4;
var numberOfGamesRun = -1;

var game_results = [];


/*case 38:  /* Up arrow was pressed
velocity.x += Math.sin(direction * (Math.PI/180));
velocity.y += Math.cos(direction * (Math.PI/180));
break;
case 37:  /* Left arrow was pressed
direction -= 15;
break;
case 39:  /* Right arrow was pressed
direction += 15;
break;*/

var players = [{name : 'anton', keys : { left : 37, right : 40}}];

var _restartCallback = function(game_result) {
    numberOfGamesRun++;
    game_results.push(game_result);
    if (numberOfGamesRun != numberOfGames) {
        World.clear();
        World.startGame(players, _restartCallback);
    }
};
console.log("restart callback!");
_restartCallback();
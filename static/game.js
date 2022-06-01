const volumeSlider = document.querySelector('.volumeSlider');
const volumeSymbol = document.querySelector('#volumeSymbol');
const noMoveText = document.querySelector('#noMoveText');
const moveText = document.querySelector('#moveText');
const helpModeSwitch = document.querySelector('.helpModeSwitch');
const btnPlayAgainYes = document.querySelector('#playAgainYes');
const btnPlayAgainNo = document.querySelector('#playAgainNo');
var turnMsg = document.querySelector('.turnMsg');
var checkbox = document.querySelector('#helpModeCheckbox');
const winnerTag = document.querySelector('#winner');
const gameOverMsg = document.querySelector('.gameOver');
const btnGoToHome = document.querySelector('#goToHome');

// const ping = document.querySelector('.ping');
// const ping2 = document.querySelector('.ping2');

var socket;
var myColor = null;
var username;
var rematch = null;
var opp_rematch = null;

socket = io('http://' + document.domain + ':' + location.port + '/game');

socket.on('connect', () => {
    socket.emit('join', { data: 'I am connected' });
});

socket.on('computer_move', () => {
    document.querySelector('.computerThinkingMsg').style.display = 'inline';
    const moves = returnAllLegalMoves(gameValues, turn);
    const nMoves = moves.length;
    // scale the length of 'computer thinking' by how many moves are available to it
    const delay = 250 + Math.floor(Math.random() * 500 * nMoves);
    setTimeout(computerMove, 250);
})

socket.on('player', (data) => {
    console.log('Socket: player');
    username = data.username;
    opponent = data.opponent;
    color = data.color;
    var playerColor = document.querySelector('#colorSelf');
    var playerName = document.querySelector('.playerName');
    playerColor.classList.remove('unassigned');
    playerColor.classList.add(color);
    playerName.innerText = data.username;
    myColor = color;

    var opponentColor = document.querySelector('#colorOpp');
    var opponentName = document.querySelector('.opponentName');
    opponentColor.classList.remove('unassigned');
    opponentColor.classList.add(flipColor(color));
    opponentName.innerText = opponent;

    if (color == 'white') {
        document.querySelector('.waitingOppMsg').style.display = 'inline';
    }
});

socket.on('start_game', () => {
    console.log('Socket: start game');
    document.querySelector('.waitingOppMsg').style.display = 'none';

});

socket.on('move', (data) => {
    const color = data.player;
    const row = data.row;
    const col = data.col;

    // this checks whether the message is a move from my opponent of if this is the server
    // sending my own move back to me
    if (color != myColor) {
        console.log('Socket: move');
        console.log(`row: ${row}, col: ${col}`)
        move(row, col);
    }
})

socket.on('rematch_status', (data) => {

    if (data.sender != username) {
        console.log('Socket:rematch_status')
        const oppStatus = data.rematch;
        console.log(oppStatus);
        if (rematch != false) showRematchStatus(oppStatus);
    }
})

socket.on('opp_disconnect', (data) => {
    inputActive = false;
    showOppDisconnectMsg(data.code);

})

// window.addEventListener('beforeunload', (event) => {
//     event.preventDefault();
//     socket.emit('player_disconnecting', { player: myColor });
// })

var helpMode = false;

var volume = 0.5;
var lastVolume = 0.5;
// ping.volume = volume;
// ping2.volume = volume;

const gameBoard = document.querySelector('.gameBoard');

var turnIndicator = document.querySelector('.turnIndicator');
const body = document.querySelector('body');



// setInterval(function () {
//     if (inputActive) {
//         ping.load();
//         ping2.load();
//     }
// }, 1000);

const squares = document.querySelectorAll('.square');

const neighborCoordinates = [
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1]
];

var turn = 'black';
var turnTemp = 'black';
var inputActive = true;
var gameOver = false;
var whiteRemainingPieces = 32;
var blackRemainingPieces = 32;
var whiteScore = 0;
var blackScore = 0;

var gameValues = new Array(8);
for (let i = 0; i < gameValues.length; i++) {
    gameValues[i] = new Array(8);
}

initBoard();

function initBoard() {

    // const whitePieces = [
    //     [3, 3],
    // ];

    // const blackPieces = [
    //     [3, 4],
    //     [4, 3],
    //     [4, 4]
    // ];

    const whitePieces = [
        [3, 3],
        [4, 4]
    ];

    const blackPieces = [
        [3, 4],
        [4, 3]
    ];

    turn = 'black';
    turnTemp = 'black';
    inputActive = true;
    gameOver = false;
    helpMode = false;
    checkbox.checked = false;
    whiteRemainingPieces = 32;
    blackRemainingPieces = 32;
    whiteScore = 0;
    blackScore = 0;
    turnIndicator.classList.remove('white');
    turnIndicator.classList.add('black');
    turnIndicator.style.transitionDelay = '0s';
    removePieces();
    clearAllLegalMoves();

    for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
            gameValues[r][c] = null;
        }
    }

    for (let white of whitePieces) {
        const row = white[0];
        const col = white[1];
        const square = document.querySelector(`#R${row}C${col}`);
        var piece = document.createElement('div');
        piece.classList.add('gamePiece');
        piece.style.backgroundColor = 'white';
        square.appendChild(piece);
        gameValues[row][col] = 'white';
        whiteRemainingPieces--;
        whiteScore++;
    }

    for (let black of blackPieces) {
        const row = black[0];
        const col = black[1];
        const square = document.querySelector(`#R${row}C${col}`);
        var piece = document.createElement('div');
        piece.classList.add('gamePiece');
        piece.style.backgroundColor = 'black';
        square.appendChild(piece);
        gameValues[row][col] = 'black';
        blackRemainingPieces--;
        blackScore++;
    }
}

squares.forEach(item => {
    item.addEventListener('click', () => {
        // get the row and column
        if (!gameOver && inputActive && turn == myColor) {
            const pos = getSquareCoord(item);
            const row = pos[0];
            const col = pos[1];
            const moves = returnMoveArray(row, col, gameValues, turn);
            console.log(`Moves: ${moves}`);
            if (moves.length) {
                if (opponent != 'computer') {
                    socket.emit('move', { player: myColor, row: row, col: col });
                }
                body.classList.add('disableCursor');
                move(row, col, moves);
                // inputActive = false;
                // var piece = document.createElement('div');
                // piece.classList.add('gamePiece');
                // piece.classList.add(turn);
                // item.appendChild(piece);
                // gameValues[row][col] = turn;
                // var delay = flipPieces(row, col, moves);
                // turnTemp = turn;
                // changeTurn(delay);
            }
        }
    })
})

function move(row, col, moves = null) {
    clearAllLegalMoves();
    if (!moves) moves = returnMoveArray(row, col, gameValues, turn);
    var piece = document.createElement('div');
    const square = document.querySelector(`#R${row}C${col}`);
    piece.classList.add('gamePiece');
    piece.classList.add(turn);
    square.appendChild(piece);
    gameValues[row][col] = turn;
    var delay = flipPieces(row, col, moves);
    turnTemp = turn;
    changeTurn(delay);
}

function showAllLegalMoves() {
    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            var moves = returnMoveArray(row, col, gameValues, turn);
            if (moves.length) {
                const square = document.querySelector(`#R${row}C${col}`);
                var legalMove = document.createElement('div');
                legalMove.classList.add('gamePiece');
                legalMove.classList.add('legalMove');
                square.appendChild(legalMove);
            }
        }
    }
}

function returnAllLegalMoves(board, turn) {
    var legalMoves = [];
    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            var moves = returnMoveArray(row, col, board, turn);
            if (moves.length) {
                legalMoves.push([row, col]);
            }
        }
    }

    return legalMoves;
}

function isMoveAvailable(board, turn) {
    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            var moves = returnMoveArray(row, col, board, turn);
            if (moves.length) {
                return true;
            }
        }
    }

    return false;
}

function clearAllLegalMoves() {
    const markers = document.querySelectorAll('.legalMove');
    if (markers.length) {
        markers.forEach(item => {
            item.remove();
        })
    }
}

function flipPieces(row, col, moves) {
    var delay = 0;
    // ping.preload = "auto";
    for (let move of moves) {
        const i = move[0];
        var R = row;
        var C = col;
        const delR = neighborCoordinates[i][0];
        const delC = neighborCoordinates[i][1];;
        for (var j = 0; j < move[1]; j++) {
            //update position
            R += delR;
            C += delC;
            gameValues[R][C] = turn;
            const square = document.querySelector(`#R${R}C${C}`);
            let piece = square.querySelector('.gamePiece');
            piece.classList.remove('rotate');
            // piece.classList.remove(flipColor());
            // void piece.offsetWidth;
            // setTimeout(function () { }, 1);
            piece.classList.add('rotate');
            piece.style.transitionDelay = `${0.5 * delay}s`;
            // piece.classList.add(turn);
            piece.style.backgroundColor = turn;
            // piece.style.transition = `transform 1s ${delay}, background-color 1s ${delay}`;
            delay++;

        }
    }

    return delay;
}

function updateBoard(row, col, board, turn) {
    const moves = returnMoveArray(row, col, board, turn);
    board[row][col] = turn;
    for (let move of moves) {
        const i = move[0];
        var R = row;
        var C = col;
        const delR = neighborCoordinates[i][0];
        const delC = neighborCoordinates[i][1];;
        for (var j = 0; j < move[1]; j++) {
            //update position
            R += delR;
            C += delC;
            board[R][C] = turn;
        }
    }
}

function getSquareCoord(square) {
    const name = square.id;
    const row = parseInt(name.slice(1, 2));
    const col = parseInt(name.slice(3));

    return ([row, col]);
}

// checks if adding a piece at the given location is a legal move
function returnMoveArray(row, col, board, turn) {
    var R, C;
    var moves = [];

    //first make sure the square is empty. If it is not empty, no moves are legal
    if (board[row][col]) return moves;
    for (let i = 0; i < 8; i++) {
        const delR = neighborCoordinates[i][0];
        const delC = neighborCoordinates[i][1];
        R = row + delR;
        C = col + delC;

        var nPieces = 0;
        // check if this position contains an opponent's piece
        while (isPosValid(R, C) && board[R][C] === flipColor(turn)) {
            R += delR;
            C += delC;
            nPieces++;
        }

        // the while loop ends if we come across a square that is empty, contains the current player's piece,
        // or is not a valid square. Check which is the case.
        if (isPosValid(R, C) && board[R][C] === turn && nPieces > 0) {
            moves.push([i, nPieces]);
        }
    }

    return moves;
}

// simply returns opposite of whoever's turn it is
function flipColor(t = turn) {
    if (t === 'white') return 'black';
    return 'white';
}

function isPosValid(row, col) {
    if ((row >= 0 && row < 8) && (col >= 0 && col < 8)) return true;
    return false;
}

function changeTurn(delay = 0) {
    console.log(delay);
    var extra_delay = 0;

    // if (true) {
    if (isMoveAvailable(gameValues, flipColor())) {
        turnIndicator.classList.remove(turn);
        turn = flipColor();
        turnIndicator.classList.add(turn);
        turnIndicator.style.transitionDelay = `${0.5 * delay}s`;
    } else {
        // check for game over condition
        if (!isMoveAvailable(gameValues, turn)) {
            gameOver = true;
            console.log('game over');
        } else {
            noMoveText.innerText = flipColor();
            moveText.innerText = turn;
            extra_delay = 3000;
            setTimeout(function () {
                turnMsg.style.display = 'inline';
            }, delay * 0.5 * 1000 + 500);
            setTimeout(() => {
                turnMsg.style.display = 'none';
            }, delay * 0.5 * 1000 + 500 + extra_delay);
        }
    }

    setTimeout(removeRotateClass, delay * 0.5 * 1000 + 1 + extra_delay);
    setTimeout(activateInput, delay * 0.5 * 1000 + 500 + extra_delay);
    if (helpMode) setTimeout(showAllLegalMoves, delay * 0.5 * 1000 + 500 + extra_delay);
    if (gameOver) {
        setTimeout(handleGameOverEvent, delay * 0.5 * 1000 + 500);
    } else if (opponent == 'computer' && turn == 'white') {
        // it is the computer's turn.
        setTimeout(() => {
            socket.emit('computer_move');
        }, delay * 0.5 * 1000 + 500);
    }
}

function computerMove() {
    document.querySelector('.computerThinkingMsg').style.display = 'none';
    console.log("computer's move.");
    const m = alphabeta(6, turn);

    move(m[0], m[1]);
}

function copyBoard(board) {
    var boardCopy = new Array(8);
    for (let i = 0; i < boardCopy.length; i++) {
        boardCopy[i] = new Array(8);
    }
    for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
            boardCopy[r][c] = board[r][c];
        }
    }

    return boardCopy;
}

function isGameOver(board) {
    if (!isMoveAvailable(board, turn) && !isMoveAvailable(board, flipColor())) {
        return true;
    }

    return false;
}

function alphabeta(depth, turn) {

    function helper(board, depth, a, b, turn, maximizingPlayer) {
        // get a list of all the legal moves available
        var moves = returnAllLegalMoves(board, turn);

        // console.log('Board state:');
        // console.log(board);

        // console.log(`legal moves (${moves.length}):`);
        // for (let move of moves) {
        //     console.log(move);
        // }

        // first check for end condition
        if (moves.length === 0 || depth === 0) {
            // assign a score based on the state of the board
            var score = getScore(board);
            const gameOver = isGameOver(board);
            if (gameOver && score != 0) {
                console.log('gameOver true.');
                score = Infinity * score / Math.abs(score);
            }
            return [0, score];
        }

        if (maximizingPlayer) {
            var maxValue = -Infinity;
            var maxIndex = 0;
            for (let i = 0; i < moves.length; i++) {
                // we call helper function once for each available move
                // create a copy of the board and update with each move
                var boardCopy = copyBoard(board);
                // update the board with the move that was passed in
                var move = moves[i];
                const row = move[0];
                const col = move[1];
                updateBoard(row, col, boardCopy, turn);

                var value = helper(boardCopy, depth - 1, a, b, flipColor(turn), false);
                if (value[1] > maxValue) {
                    maxValue = value[1];
                    maxIndex = i;
                }
                if (value[1] >= b) break;
                a = Math.max(a, maxValue);
            }
            return [moves[maxIndex], maxValue];
        }
        else {
            var minValue = Infinity;
            var minIndex = 0;
            for (let i = 0; i < moves.length; i++) {
                // we call helper function once for each available move
                // create a copy of the board and update with each move
                var boardCopy = copyBoard(board);
                // update the board with the move that was passed in
                var move = moves[i];
                const row = move[0];
                const col = move[1];
                updateBoard(row, col, boardCopy, turn);
                var value = helper(boardCopy, depth - 1, a, b, flipColor(turn), true);
                if (value[1] < minValue) {
                    minValue = value[1];
                    minIndex = i;
                }
                if (value[1] <= a) break;
                b = Math.min(b, minValue);
            }
            return [moves[minIndex], minValue];
        }
    }

    const value = helper(gameValues, depth, -Infinity, Infinity, turn, true);

    console.log(`Best move: ${value[0]}`);
    console.log(`Move value: ${value[1]}`);

    return value[0];
}

function getScore(board) {
    var white = 0;
    var black = 0;

    for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
            if (board[r][c] === 'white') {
                white++;
            } else if (board[r][c] === 'black') {
                black++;
            }
        }
    }

    const diff = white - black;
    return diff;
}

function handleGameOverEvent() {
    // calculate winner
    var white = 0;
    var black = 0;
    var winner;

    var my_score = 0;
    var opp_score = 0;

    for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
            if (gameValues[r][c] === 'white') {
                white++;
            } else if (gameValues[r][c] === 'black') {
                black++;
            }
        }
    }

    if (myColor == 'black') {
        my_score = black;
        opp_score = white;
    } else {
        my_score = white;
        opp_score = black;
    }

    if (white > black) {
        winner = 'white';
    } else if (black > white) {
        winner = 'black';
    } else {
        winner = 'tie';
    }

    if (winner == myColor) {
        winnerTag.innerText = 'You win!';
        game_result = 'win';
        gameOverMsg.classList.add('winner');
    } else if (winner == flipColor(myColor)) {
        winnerTag.innerText = 'You lose!';
        game_result = 'lose';
        gameOverMsg.classList.add('loser');
    } else {
        winnerTag.innerText = 'Tie game!';
        game_result = 'tie';
    }

    socket.emit('game_result', { result: game_result, my_score: my_score, opp_score: opp_score });

    gameOverMsg.style.display = 'block';

}

function resetGame() {
    const playAgain = document.querySelector('#playAgain');
    playAgain.innerText = 'Play again?';
    btnPlayAgainYes.disabled = false;
    btnPlayAgainNo.disabled = false;
    gameOverMsg.classList.remove('winner', 'loser');
    gameOverMsg.style.display = 'none';
    rematch = null;
    opp_rematch = null;
    initBoard();
}

function removeRotateClass() {
    const pieces = document.querySelectorAll('.gamePiece');
    pieces.forEach((piece) => {
        // void piece.offsetWidth;
        piece.classList.remove('rotate');
    })
    console.log(`ping currentTime: ${ping.currentTime}`);
    console.log(`ping currentTime: ${ping.duration}`);
}

function activateInput() {
    inputActive = true;
    body.classList.remove('disableCursor');
    console.log('activate input');
}

function zeroTransitionDelay() {
    const pieces = document.querySelectorAll('.gamePiece');
    pieces.forEach((piece) => {
        piece.style.transitionDelay = '0s';
    })
}

function updateVolumeSettings() {
    ping.volume = volume;
    ping2.volume = volume;
    if (volume == 0) {
        volumeSymbol.innerHTML = '&#128263;';
    } else if (volume < 0.33) {
        volumeSymbol.innerHTML = '&#128264;';
    } else if (volume < 0.66) {
        volumeSymbol.innerHTML = '&#128265;';
    } else {
        volumeSymbol.innerHTML = '&#128266;';
    }
}

function removePieces() {
    const pieces = document.querySelectorAll('.gamePiece');
    pieces.forEach((piece) => {
        // void piece.offsetWidth;
        piece.remove();
    })
}

function showRematchStatus(oppStatus) {

    // opponent has declined a rematch
    if (!oppStatus) {
        gameOverMsg.style.display = 'none';
        const oppDisconnect = document.querySelector('.oppDisconnect');
        oppDisconnect.style.display = 'block';
        const oppDisconnectMsg = document.querySelector('#oppDisconnectMsg');
        oppDisconnectMsg.innerText = 'Your opponent declined a rematch.';
    } else {
        // if I have already also said yes to a rematch, reset them
        if (rematch) {
            const playAgain = document.querySelector('#playAgain');
            playAgain.innerText = 'Rematch is on!';
            setTimeout(resetGame, 2000);
        } else {
            // i have not yet made a decision on whether to rematch, so I need to store
            // that my opponent wants a rematch
            opp_rematch = true;
        }
    }
}

function showOppDisconnectMsg(code) {
    const oppDisconnect = document.querySelector('.oppDisconnect');
    const msg = document.querySelector('#oppDisconnectMsg');

    if (code == 'disconnect') {
        msg.innerText = 'Your opponent has disconnected from the game; you have been credited with a win.';
    }
    else {
        msg.innerText = 'Your opponent has canceled the game.';
    }

    oppDisconnect.style.display = 'block';
}

// gameBoard.addEventListener('transitionstart', (event) => {
//     const target = event.target;
//     if (target.classList.contains('gamePiece')) {
//         console.log('ping');
//         if (turnTemp === 'white') {
//             const ping = new Audio('/static/flip_sound_400ms.wav');
//             ping.volume = volume;
//             ping.play();
//         } else {
//             const ping2 = new Audio('/static/flip_sound_400ms_black.wav');
//             ping2.volume = volume;
//             ping2.play();
//         }
//     }
// })

volumeSlider.addEventListener('change', () => {
    // get the current value
    volume = 0.01 * volumeSlider.value;
    updateVolumeSettings();
})

volumeSymbol.addEventListener('click', () => {
    if (volume > 0) {
        lastVolume = volume;
        volume = 0;
        volumeSlider.value = 0;
    } else {
        volume = lastVolume;
        volumeSlider.value = volume * 100;
    }
    updateVolumeSettings();
})

helpModeSwitch.addEventListener('click', () => {
    if (checkbox.checked) {
        helpMode = true;
        showAllLegalMoves();
    } else {
        helpMode = false;
        clearAllLegalMoves();
    }
})

btnPlayAgainYes.addEventListener('click', () => {
    btnPlayAgainYes.disabled = true;
    btnPlayAgainNo.disabled = true;
    console.log(myColor);
    rematch = true;

    if (opp_rematch) {
        // I have already received a message that my opponent wants a rematch, so I can immediatley reset the game
        const playAgain = document.querySelector('#playAgain');
        playAgain.innerText = 'Rematch is on!';
        setTimeout(resetGame, 2000);
    } else {
        // opponent has not yet decided if they want a rematch, so we need to wait for their decision.
        const playAgain = document.querySelector('#playAgain');
        playAgain.innerText = 'Waiting for opponent...';
    }
    // Either way, we send a message back to the server indicating we want a rematch
    socket.emit('rematch', { player: username, rematch: true });
})

btnPlayAgainNo.addEventListener('click', () => {
    gameOverMsg.style.display = 'none';
    socket.emit('rematch', { player: username, rematch: false });
    const oppDisconnect = document.querySelector('.oppDisconnect');
    oppDisconnect.style.display = 'block';
    const oppDisconnectMsg = document.querySelector('#oppDisconnectMsg');
    oppDisconnectMsg.innerText = 'You declined a rematch.';
    rematch = false;
})

btnGoToHome.addEventListener('click', () => {
    // send message back to server so that it can remove me from the room
    socket.emit('leave');
})
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

function testFunc() {
    console.log('Alphabeta import test');
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

function flipColor(t) {
    if (t === 'white') return 'black';
    return 'white';
}

function isPosValid(row, col) {
    if ((row >= 0 && row < 8) && (col >= 0 && col < 8)) return true;
    return false;
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
    if (!isMoveAvailable(board, 'white') && !isMoveAvailable(board, 'black')) {
        return true;
    }

    return false;
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

    return [white, black];
}

// Function will use minimax algorithm to find the best move after looking n moves ahead
// This algorithm is 'dumb' in that it only evaluates the state of the board by which player
// has more pieces on the board, it does not consider which player has his pieces in a more
// advantageous position/grouping
function alphabeta(depth, turn, board) {

    var player = turn;
    function helper(board, depth, a, b, turn, maximizingPlayer) {
        // get a list of all the legal moves available
        var moves = returnAllLegalMoves(board, turn);

        // first check for end condition
        if (moves.length === 0 || depth === 0) {
            // assign a score based on the state of the board
            var score = getScore(board);
            var score_diff = score[0] - score[1]; // white - black
            if (player === 'black') score_diff = -score_diff;
            const gameOver = isGameOver(board);
            if (gameOver && score_diff != 0) {
                // console.log('gameOver true.');
                score_diff = Infinity * score_diff / Math.abs(score_diff);
            }

            return [0, score_diff];
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

    const value = helper(board, depth, -Infinity, Infinity, turn, true);

    console.log(`Best move: ${value[0]}`);
    console.log(`Move value: ${value[1]}`);

    return value[0];
}
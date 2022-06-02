const btnSendInvite = document.querySelector('.btnSendInvite');
const inviteStatus = document.querySelector('.inviteStatus');
const userInviteTextField = document.querySelector('#userInvite');
const btnPlayComputer = document.querySelector('.btnPlayComputer');

// game elements
const volumeSlider = document.querySelector('.volumeSlider');
const volumeSymbol = document.querySelector('#volumeSymbol');
const helpModeSwitch = document.querySelector('.helpModeSwitch');
var turnMsg = document.querySelector('.turnMsg');
var checkbox = document.querySelector('#helpModeCheckbox');
const btnHint = document.querySelector('.btnHint');
const nHintsContainer = document.querySelector('.nHints-container');
const nHintsSpan = document.querySelector('.nHints');
const btnTest = document.querySelector('.btnTest');
const difficultySlider = document.querySelector('.difficultySlider');
const gameBoard = document.querySelector('.gameBoard');
var turnIndicator = document.querySelector('.turnIndicator');
const body = document.querySelector('body');
const squares = document.querySelectorAll('.square');

import * as ab from './abFuncs.js';

disableHints(true);
helpModeSwitch.disabled = true;

var socket, w;
var myColor = null;
var username, opponent;
var rematch = null;
var opp_rematch = null;
var playerScore, oppScore;
var nHints;
var nMovesAhead = difficultySlider.value;
var autoplay = false;

var helpMode = false;

var volume = 0.5;
var lastVolume = 0.5;
// ping.volume = volume;
// ping2.volume = volume;

var turn = 'black';
var turnTemp = 'black';
var inputActive = true;
var gameOver = false;
var gameActive = false;
var whiteRemainingPieces = 32;
var blackRemainingPieces = 32;
var whiteScore = 0;
var blackScore = 0;

var quickGame = false;

var gameValues = new Array(8);
for (let i = 0; i < gameValues.length; i++) {
    gameValues[i] = new Array(8);
}

const messageWindow = {
    getHtmlTemplate(message, animate_flag, buttons) {
        var str = `
        <div class="message__window">
            <div class="message__content">${message}</div>
            `;

        if (animate_flag) {
            str += `
            <div>
                <div class="thinkingBall ball1"></div>
                <div class="thinkingBall ball2"></div>
                <div class="thinkingBall ball3"></div>
            </div>
                `;
        }

        if (buttons != 'none') {
            for (const button of buttons) {
                str += `
            <button class="${button['class']}">${button['label']}</button>`
            };
        }

        str += '</div>';

        return str;
    },

    showMessage(message, animate_flag, buttons = null, expire_time = null) {
        // if no buttons were included, then we add a default button that simply closes the window.
        if (buttons == null) {
            const btn = {
                class: 'message__close',
                label: 'Close',
                func: function () {
                    console.log('Message window closed.');
                    document.querySelector('.message__window').remove();
                }
            };

            buttons = [btn];
        } else if (buttons == 'refresh') {
            const btn = {
                class: 'message__close',
                label: 'Close',
                func: function () {
                    console.log('Message window closed.');
                    document.querySelector('.message__window').remove();
                    // location.reload();

                    /*
                    if you weren't playing a game against the computer, send out message to invitees
                    that you are now available
                    */
                    if (opponent != 'Computer') socket.emit('available');
                    // add function to refresh the display without actually refreshing the connection
                    refreshDisplay();
                }
            };

            buttons = [btn];
        }
        const messageTemplate = this.getHtmlTemplate(message, animate_flag, buttons);
        const board = document.querySelector('.gameBoard');
        board.insertAdjacentHTML('afterend', messageTemplate);

        if (buttons != 'none') {
            for (const button of buttons) {
                document.querySelector(`.${button['class']}`).addEventListener('click', button['func']);
            }
        }

        if (expire_time) {
            // set window to expire after given amount of time.
            setTimeout(() => {
                document.querySelector('.message__window').remove();
            }, expire_time);
        }
    },

    remove() {
        // Check if a message window exists before trying to remove it.
        // This allows us to call the remove function just to make sure any messages are cleared
        // without having to know if a message is showing.
        const window = document.querySelector('.message__window');
        if (window) window.remove();
    }
};

/**************************************************************************************************
                                    ----- Websockets -----
**************************************************************************************************/

socket = io('https://' + location.host);

socket.on('connect', () => {
    socket.emit('home', {});
    console.log(`document.domain: ${document.domain}`);
    console.log(`location.host: ${location.host}`);
});

socket.on('online_friends', (data) => {
    const received_online = data.received_online;
    for (let friend of received_online) {
        const invite = document.querySelector(`.receivedInvitations li#${friend}`);
        // remove offline tag from this invitation
        invite.classList.add('online');
    }

    const sent_online = data.sent_online;
    for (let friend of sent_online) {
        const invite = document.querySelector(`.sentInvitations li#${friend}`);
        // remove offline tag from this invitation
        invite.classList.add('online');
    }

    setInviteButtons();
})

socket.on('record_update', (data) => {
    updateRecord(data.record);
    updateGameLog(data.game);
})

// "friend" (someone who has sent me an invitation) has come online
// enable button to accept invitation to game
socket.on('friend_online_status', (data) => {
    setInviteButtons(data.friend, data.status);
})

socket.on('invitation_canceled', (data) => {
    const game = document.querySelector(`.receivedInvitations li#${data.inviter}`);
    game.remove();
})

socket.on('invite_status', (data) => {
    addInviteStatus(data.msg, data.invite_status);
    if (data.invite_status == 'success') {
        updateSentInvitations(data.invitee, data.online_status);
    }
})

function addInviteStatus(msg, status) {
    var str = `
        <div class="inviteStatus ${status}">
            <span>${msg}</span>
            <button class="inviteStatusClose">&#10006;</button>
        </div>`;
    const sendInvitation = document.querySelector('.sendInvitation');
    sendInvitation.insertAdjacentHTML('beforeend', str);
    const btn = document.querySelector('.inviteStatus button');
    btn.addEventListener('click', () => {
        document.querySelector('.inviteStatus').remove();
    })
}

socket.on('computer_move', () => {
    const msg = 'Computer is thinking...';
    const animateFlag = true;
    messageWindow.showMessage(msg, animateFlag, 'none');
    setTimeout(computerMove, 250 + Math.random() * 500);
})

socket.on('player', (data) => {
    console.log('Socket: player');
    username = data.username;
    opponent = data.opponent;

    var color = data.color;
    var playerColor = document.querySelector('#colorSelf');
    var playerName = document.querySelector('.playerName');
    // playerColor.classList.remove('unassigned');

    clearBoard();
    playerColor.classList.add(color);

    if (username) {
        playerName.innerText = username;
    } else {
        playerName.innerText = 'Guest';
    }
    myColor = color;
    playerScore = 2;
    document.querySelector('.playerScore').innerText = playerScore;

    var opponentColor = document.querySelector('#colorOpp');
    var opponentName = document.querySelector('.opponentName');
    // opponentColor.classList.remove('unassigned');
    opponentColor.classList.add(ab.flipColor(color));
    opponentName.innerText = opponent;
    oppScore = 2;
    document.querySelector('.opponentScore').innerText = oppScore;

    if (data.wait_for_opp) {
        const msg = `Waiting for ${opponent}...`;
        const animateFlag = true;
        const btn = {
            class: 'cancel',
            label: 'Cancel',
            func: function () {
                console.log('Game canceled.');
                socket.emit('cancel_accepted_game');
                document.querySelector('.message__window').remove();
                refreshDisplay();
            }
        };

        messageWindow.showMessage(msg, animateFlag, [btn]);
    }
});

socket.on('start_game', () => {
    console.log('Socket: start game');
    messageWindow.remove();
    (opponent == 'Computer') ? updateNumHints(Infinity) : updateNumHints(3);
    initBoard();
    setInputs(true);
    if (turn == myColor) {
        disableHints(false);
    } else {
        disableHints(true, true);
    }
});

socket.on('refresh', () => {
    console.log('Socket: refresh.');
    location.reload();
})

socket.on('invitation', (data) => {
    const inviter = data.inviter;
    var str = `
            <li class="online" id="${inviter}"><span>${inviter}</span>
                <div class="accept-decline-buttons">
                    <button class="button-component-v2 game-disable offline-disable acceptInvite"
                        id="${inviter}">&check;</button>
                    <button class="button-component-v2 declineInvite" id="${inviter}">&cross;</button>
                </div>
            </li>`;

    const receivedInvitations = document.querySelector('.receivedInvitations > ul');
    receivedInvitations.insertAdjacentHTML('beforeend', str);
})

socket.on('invite_accepted', (data) => {
    const invitee = data.invitee;
    var str = `
            <li id="${invitee}"><span>${invitee}</span>
                <div class="accept-decline-buttons">
                    <button class="button-component-v2 game-disable joinGame"
                        id="${invitee}">Join</button>
                    <button class="button-component-v2 cancelGame" id="${invitee}">Cancel</button>
                </div>
            </li>`;

    const game = document.querySelector(`.sentInvitations li#${invitee}`);
    game.remove();

    const acceptedInvitations = document.querySelector('.acceptedInvitations > ul');
    acceptedInvitations.insertAdjacentHTML('afterend', str);

    console.log(`Invite accepted by ${invitee}`);
    document.querySelector(`.cancelGame#${invitee}`).addEventListener('click', (e) => {
        const invitee = e.target.id;
        const game = document.querySelector(`.acceptedInvitations li#${invitee}`);
        game.remove();
        console.log('cancel game pressed');
        socket.emit('cancel_game', { 'invitee': invitee, 'code': 'cancel' });
    });
})

socket.on('invite_declined', (data) => {
    const invitee = data.invitee;
    const game = document.querySelector(`.sentInvitations li#${invitee}`);
    game.remove();
})

socket.on('move', (data) => {
    const color = data.player;
    const row = data.row;
    const col = data.col;

    console.log(`Socket: move by ${color}`);

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
        if (rematch != false) updateRematchStatus(oppStatus);
    }
})

socket.on('opp_disconnect', (data) => {
    inputActive = false;
    console.log('Socket: opp_disconnect.');
    console.log(`Opponent: ${data}`);

    if (opponent == data.opponent) showOppDisconnectMsg(data.code);

    // send message back to the server to count the game as a loss for the opponent
    // (who left mid-game) and a win for this user

    if (gameActive && opponent == data.opponent) {
        socket.emit('opp_forfeit');
    } else {
        /*
        If the game is not yet active, this means that our opponent initially
        accepted the invitation but then left before we joined the game, so we
        need to delete this game from our "Accepted Invitations" section
        */
        removeAcceptedInvite(data.opponent);
    }
})

/**************************************************************************************************
                                    ----- Event Listeners -----
**************************************************************************************************/

window.addEventListener('DOMContentLoaded', () => {
    // send message to server requesting info on which friends are currently online
    socket.emit('get_online_friends', {});
})

/* ----- Buttons ----- */

if (btnTest) {
    btnTest.addEventListener('click', () => {
        refreshDisplay();
    })
}

btnHint.addEventListener('click', () => {
    disableInput();
    nHints--;
    updateNumHints(nHints);
    disableHints(true, true);

    const msg = 'Thinking...'
    const animateFlag = true;
    messageWindow.showMessage(msg, animateFlag, 'none');

    w = new Worker('/static/alphabeta.js');

    w.addEventListener('message', function (e) {
        const m = e.data;

        messageWindow.remove();
        console.log(`Suggested move: ${m[0]}, ${m[1]}`)
        showHint(m[0], m[1]);

        w.terminate();
        w = undefined;
    });

    console.log(`# moves ahead: ${nMovesAhead}`);
    if (opponent == 'Computer') {
        w.postMessage([nMovesAhead, turn, gameValues]);
    } else {
        w.postMessage([8, turn, gameValues]);
    }
    // const m = ab.alphabeta(nMovesAhead + 2, turn, gameValues);

})

if (btnSendInvite) {
    btnSendInvite.addEventListener('click', () => {
        // get the username
        var username = document.querySelector('#userInvite').value;
        console.log(`Invitation sent to ${username}`)
        // send message to server informing it of the invitation
        // server will send message to invited user
        socket.emit('invite', { 'invitee': username });
    })
}

btnPlayComputer.addEventListener('click', () => {
    console.log(`moves ahead: ${nMovesAhead}`);
    socket.emit('join', { 'game_mode': 'solo', 'difficulty': nMovesAhead });
})

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('cancelInvite')) {
        const invitee = e.target.id;
        console.log(`Canceled invitation to ${invitee}`)
        const game = document.querySelector(`.sentInvitations li#${invitee}`);
        socket.emit('cancel_invite', { 'invitee': invitee });
        game.remove();
    }

    if (e.target.classList.contains('acceptInvite')) {
        const inviter = e.target.id;
        socket.emit('invite_response', { 'acceptedBool': true, 'inviter': inviter });
        console.log(`Accepted invitation from ${inviter}`)
        const game = document.querySelector(`.receivedInvitations li#${inviter}`);
        game.remove();
        // we also want to disable all other accept buttons
        disableAcceptButtons(true);

    }

    if (e.target.classList.contains('declineInvite')) {
        const inviter = e.target.id;
        socket.emit('invite_response', { 'acceptedBool': false, 'inviter': inviter });
        console.log(`Declined invitation from ${inviter}`)
        const game = document.querySelector(`.receivedInvitations li#${inviter}`);
        game.remove();
    }

    if (e.target.classList.contains('joinGame')) {
        const invitee = e.target.id;
        // const game = document.querySelector(`.acceptedInvitations li#${invitee}`);
        // game.remove();
        removeAllAcceptedInvites();
        socket.emit('join', { 'game_mode': 'vs', 'invitee': invitee });
    }

    // if (e.target.classList.contains('cancelGame')) {
    //     const invitee = e.target.id;
    //     const game = document.querySelector(`.acceptedInvitations li#${invitee}`);
    //     game.remove();
    //     console.log('cancel game pressed');
    //     socket.emit('cancel_game', { 'invitee': invitee });
    // }

    if (e.target.classList.contains('message__okay')) {
        const message_window = document.querySelector('.message__window');
        message_window.remove();
    }
})

document.addEventListener('keyup', (event) => {
    if (userInviteTextField == document.activeElement && event.key == 'Enter') btnSendInvite.click();
})

if (userInviteTextField) {
    userInviteTextField.addEventListener('click', () => {
        console.log('input clicked.');
        const status = document.querySelector('.inviteStatus');
        if (status) status.remove();
    })
}

squares.forEach(item => {
    item.addEventListener('click', () => {
        // get the row and column
        if (!gameOver && inputActive && turn == myColor) {
            const pos = getSquareCoord(item);
            const row = pos[0];
            const col = pos[1];
            const moves = ab.returnMoveArray(row, col, gameValues, turn);
            console.log(`Moves: ${moves}`);
            if (moves.length) {
                if (opponent != 'Computer') {
                    socket.emit('move', { player: myColor, row: row, col: col });
                }
                body.classList.add('disableCursor');
                disableHints(true, true);
                move(row, col, moves);
            }
        }
    })
})

difficultySlider.addEventListener('input', () => {
    // get the current value
    var value = difficultySlider.value;
    if (!gameActive) {
        nMovesAhead = value;
        document.querySelector('.difficultyNumber').innerText = nMovesAhead;
        difficultySlider.style.background = `linear-gradient(
            to right,
            #931621,
            #931621 ${10 * value}%,
            #d3d3d3 ${10 * value}%)`
    }
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

/**************************************************************************************************
                                    ----- Functions -----
**************************************************************************************************/

function disableHints(disableStatus, keepNumEnabled = false) {
    console.log(`Hint button disabled: ${disableStatus}`)
    btnHint.disabled = disableStatus;
    if (keepNumEnabled) {
        nHintsContainer.classList.remove('disabled');
    } else {
        disableStatus ? nHintsContainer.classList.add('disabled') : nHintsContainer.classList.remove('disabled');
    }
}

function updateNumHints(num) {
    console.log(`number of hints left: ${num}`);
    nHints = num;
    if (nHints == Infinity) {
        nHintsSpan.innerHTML = '&infin;';
    } else {
        nHintsSpan.innerHTML = `${nHints}`;
    }
}

function refreshDisplay() {
    clearBoard();
    setInputs(false);

    // grab the date and time of latest game in the game log and send it back to the server
    // Server-side, we will check if another game has been logged since this game or not
    const date = document.querySelector('.gamelog-table .gamelog-date').innerText;
    const time = document.querySelector('.gamelog-table .gamelog-time').innerText;
    console.log(`date: ${date}, time: ${time}`);
    socket.emit('update_record', { 'date': date, 'time': time });
}

function updateRecord(record) {
    const rec = document.querySelector('.recordSpan');
    rec.innerText = `${record['win']}-${record['loss']}-${record['tie']}`;
}

function updateGameLog(game) {
    const log = document.querySelector('.gamelog-table tbody');
    var str = `
        <tr>
            <td class="gamelog-date">${game['date']}</td>
            <td class="gamelog-time">${game['time']}</td>
            <td>${game['opponent']}</td>
            <td>${game['outcome']}</td>
            <td>${game['my_score']}</td>
            <td>${game['opp_score']}</td>
        </tr>`;
    // check if the first row contains the element 'placeholder'.
    // if it does, we want to remove this row first before adding the latest game data
    const first_row = log.querySelector('tr');
    if (first_row.classList.contains('placeholder')) {
        first_row.remove();
    }
    log.insertAdjacentHTML('afterbegin', str);

}

// status of true means we want to disable the buttons.
// status of true menas we want to enable them.
function disableAcceptButtons(status) {
    document.querySelectorAll('.acceptInvite').forEach(function (element) {
        element.disabled = status;
        status ? element.classList.add('disabled') : element.classList.remove('disabled');
    })
}

// this function will disable the buttons associated with the invites from people who are offlne
function setInviteButtons(friend = null, status = null) {
    if (friend) {
        console.log(friend);
        var invite = document.querySelector(`.sentInvitations li#${friend}`);
        if (!invite) {
            var invite = document.querySelector(`.receivedInvitations li#${friend}`);
        }
        const btn = invite.querySelector('.offline-disable');
        switch (status) {
            case 'online':
                invite.classList.add('online');
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('disabled');
                }
                break;
            case 'offline':
                invite.classList.remove('online');
                invite.classList.remove('unavailable');
                if (btn) {
                    btn.disabled = true;
                    btn.classList.add('disabled');
                }
                break;
            case 'available':
                invite.classList.remove('unavailable');
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('disabled');
                }
                break;
            case 'unavailable':
                invite.classList.add('unavailable');
                if (btn) {
                    btn.disabled = true;
                    btn.classList.add('disabled');
                }
                break;
        }
    } else {
        document.querySelectorAll('.online .offline-disable').forEach(function (element) {
            element.disabled = false;
            element.classList.remove('disabled');
        })
    }
}

function updateSentInvitations(invitee, status) {
    var str = `
            <li class="${status}" id="${invitee}"><span>${invitee}</span>
                <div class="accept-decline-buttons">
                    <button class="button-component-v2 cancelInvite" id="${invitee}">Cancel</button>
                </div>
            </li>`;

    const sentInvitations = document.querySelector('.sentInvitations > ul');
    sentInvitations.insertAdjacentHTML('beforeend', str);
}

// the status input indicates whether a game is ongoing.
// enable/disable various inputs accordingly
function setInputs(status) {
    // btnPlayComputer.disabled = status;
    // difficultySlider.disabled = status;
    // helpModeSwitch.disabled = !status;

    // grab all elements that should be disabled when a game is active
    document.querySelectorAll('.game-disable').forEach(function (element) {
        element.disabled = status;
        status ? element.classList.add('disabled') : element.classList.remove('disabled');
    })

    if (opponent != 'Computer') {
        // grab all elements that should be disabled when a game vs another user is active
        // i.e., these elements should not be disabled if you're playing against the computer
        document.querySelectorAll('.vs-game-disable').forEach(function (element) {
            element.disabled = status;
            status ? element.classList.add('disabled') : element.classList.remove('disabled');
        })
    }

    // grab all elements that should be enabled when a game is active
    document.querySelectorAll('.game-enable').forEach(function (element) {
        element.disabled = !status;
        status ? element.classList.remove('disabled') : element.classList.add('disabled');
    })
}


function showOppDisconnectMsg(code) {
    var msg;
    if (code == 'offline') {
        msg = `${opponent} has logged off or been disconnected.`;
        if (gameActive) {
            msg += ' You have been credited with a win.';
        }
    }
    else if (code == 'cancel') {
        msg = `${opponent} has canceled the game.`;
    }
    else if (code == 'unavailable') {
        msg = `${opponent} has joined another game.`;
    }

    if (code != 'cancel_after_accept') {
        // remove any message currently showing
        messageWindow.remove();
        messageWindow.showMessage(msg, false, 'refresh');
    }
}

function removeAcceptedInvite(opponent) {
    const game = document.querySelector(`.acceptedInvitations li#${opponent}`);
    if (game) {
        game.remove();
        // send message back to server to remove this game from list of accepted invitations
        socket.emit('remove_accepted_invitation', { opponent: opponent });
    }
}

function removeAllAcceptedInvites() {
    document.querySelectorAll('.acceptedInvitations li').forEach(game => {
        game.remove();
    });
}

function clearBoard() {
    removePieces();
    clearAllLegalMoves();
    clearScoreboard();
    disableHints(true);
}

function clearScoreboard() {
    var playerColor = document.querySelector('#colorSelf');
    var opponentColor = document.querySelector('#colorOpp');
    var opponentName = document.querySelector('.opponentName');
    // opponentColor.classList.remove('unassigned');
    playerColor.classList.remove('white', 'black');
    opponentColor.classList.remove('white', 'black');
    opponentName.innerText = '- -';
    document.querySelector('.playerScore').innerText = '-';
    document.querySelector('.opponentScore').innerText = '-';
}

function initBoard() {

    var whitePieces, blackPieces;

    if (quickGame) {
        whitePieces = [
            [3, 3]
        ];

        blackPieces = [
            [3, 4],
            [4, 3],
            [4, 4]
        ];
    } else {
        whitePieces = [
            [3, 3],
            [4, 4]
        ];

        blackPieces = [
            [3, 4],
            [4, 3]
        ];
    }

    turn = 'black';
    turnTemp = 'black';
    inputActive = true;
    gameOver = false;
    gameActive = true;
    helpMode = false;
    checkbox.checked = false;
    whiteRemainingPieces = 32;
    blackRemainingPieces = 32;
    whiteScore = 0;
    blackScore = 0;
    turnIndicator.classList.remove('white');
    turnIndicator.classList.add('black');
    turnIndicator.style.transitionDelay = '0s';

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

function move(row, col, moves = null) {
    clearAllLegalMoves();
    if (!moves) moves = ab.returnMoveArray(row, col, gameValues, turn);
    var piece = document.createElement('div');
    const square = document.querySelector(`#R${row}C${col}`);
    piece.classList.add('gamePiece');
    piece.classList.add('addedPiece');
    piece.classList.add(turn);
    square.appendChild(piece);
    gameValues[row][col] = turn;
    var delay = flipPieces(row, col, moves);
    turnTemp = turn;
    updateScore();
    changeTurn(delay);
}

function updateScore() {
    var score = ab.getScore(gameValues);
    if (myColor == 'white') {
        playerScore = score[0];
        oppScore = score[1];
    } else {
        playerScore = score[1];
        oppScore = score[0];
    }
    document.querySelector('.playerScore').innerText = playerScore;
    document.querySelector('.opponentScore').innerText = oppScore;
    console.log(`Updated score: white ${playerScore}, black ${oppScore}`);
}

function showAllLegalMoves() {
    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            var moves = ab.returnMoveArray(row, col, gameValues, turn);
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

function showHint(row, col) {
    const square = document.querySelector(`#R${row}C${col}`);
    var legalMoveFlag = false;
    if (square.children.length && square.children[0].classList.contains('legalMove')) {
        square.children[0].classList.remove('legalMove');
        square.children[0].classList.add('moveHint');
        legalMoveFlag = true;
    } else {
        var hint = document.createElement('div');
        hint.classList.add('gamePiece');
        hint.classList.add('moveHint');
        square.appendChild(hint);
    }
    setTimeout(() => {
        if (legalMoveFlag) {
            square.children[0].classList.remove('moveHint');
            square.children[0].classList.add('legalMove');
        } else {
            hint.remove();
        }
        enableInput();
        if (nHints > 0) disableHints(false);
    }, 1000);
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
    for (let move of moves) {
        const i = move[0];
        var R = row;
        var C = col;
        const delR = ab.neighborCoordinates[i][0];
        const delC = ab.neighborCoordinates[i][1];;
        for (var j = 0; j < move[1]; j++) {
            //update position
            R += delR;
            C += delC;
            gameValues[R][C] = turn;
            const square = document.querySelector(`#R${R}C${C}`);
            let piece = square.querySelector('.gamePiece');
            piece.classList.remove('rotate');
            // piece.classList.remove(ab.flipColor());
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

function getSquareCoord(square) {
    const name = square.id;
    const row = parseInt(name.slice(1, 2));
    const col = parseInt(name.slice(3));

    return ([row, col]);
}

function changeTurn(delay = 0) {
    console.log(delay);
    var extra_delay = 0;

    // if (true) {
    if (ab.isMoveAvailable(gameValues, ab.flipColor(turn))) {
        turnIndicator.classList.remove(turn);
        turn = ab.flipColor(turn);
        turnIndicator.classList.add(turn);
        turnIndicator.style.transitionDelay = `${0.5 * delay}s`;
    } else {
        // check for game over condition
        if (!ab.isMoveAvailable(gameValues, turn)) {
            gameOver = true;
            console.log('game over');
        } else {
            extra_delay = 2000;
            setTimeout(function () {
                var msg = `There is no move available for ${ab.flipColor(turn)}; it is still ${turn}'s turn`;
                messageWindow.showMessage(msg, false, 'none', extra_delay); // sets window to automatically expire after given time
            }, delay * 0.5 * 1000 + 500);
        }
    }

    // setTimeout(removeRotateClass, delay * 0.5 * 1000 + 1 + extra_delay);
    setTimeout(enableInput, delay * 0.5 * 1000 + 500 + extra_delay);
    if (turn == myColor) {
        setTimeout(() => {
            if (nHints > 0) disableHints(false);
        }, delay * 0.5 * 1000 + 500 + extra_delay);
    }
    if (helpMode) setTimeout(showAllLegalMoves, delay * 0.5 * 1000 + 500 + extra_delay);
    if (gameOver) {
        gameActive = false;
        setTimeout(handleGameOverEvent, delay * 0.5 * 1000 + 500);
    } else if (opponent == 'Computer') {
        if (turn != myColor) {
            // it is the computer's turn.
            setTimeout(() => {
                socket.emit('computer_move');
            }, delay * 0.5 * 1000 + 500 + extra_delay);
        } else if (autoplay) {
            socket.emit('autoplay');
        }
    }
}

function computerMove() {
    console.log("computer's move.");

    w = new Worker('/static/alphabeta.js');

    w.addEventListener('message', function (e) {
        const m = e.data;

        messageWindow.remove();
        console.log(`Suggested move: ${m[0]}, ${m[1]}`)
        move(m[0], m[1]);

        w.terminate();
        w = undefined;
    });

    w.postMessage([nMovesAhead, turn, gameValues]);
}

function handleGameOverEvent() {
    // calculate winner
    var white = 0;
    var black = 0;
    var winner, game_result;

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
        game_result = 'win';
    } else if (winner == ab.flipColor(myColor)) {
        game_result = 'loss';
    } else {
        game_result = 'tie';
    }

    socket.emit('game_result', { result: game_result, my_score: my_score, opp_score: opp_score });

    // gameOverMsg.style.display = 'block';
    displayGameOver(game_result);

}

function displayGameOver(game_result) {
    var msg;
    switch (game_result) {
        case 'win':
            msg = 'You win!';
            break;
        case 'loss':
            msg = 'You lose!';
            break;
        case 'tie':
            msg = 'Tie game!';
    }

    const btnRematch = {
        class: 'rematch',
        label: 'Rematch',
        func: function () {
            rematch = true;
            // remove the current message window
            messageWindow.remove();
            if (opp_rematch) {
                // I have already received a message that my opponent wants a rematch, so I can immediatley reset the game

                // display a new message indicating that the rematch is on
                const msg = 'Rematch is on!';
                messageWindow.showMessage(msg, false, 'none');
                setTimeout(resetGame, 2000);
            } else {
                // opponent has not yet decided if they want a rematch, so we need to wait for their decision.
                const msg = `Waiting for ${opponent}...`;
                messageWindow.showMessage(msg, false, 'none');
            }
            // Either way, we send a message back to the server indicating we want a rematch
            socket.emit('rematch', { player: username, rematch: true });
        }
    };

    const btnLeave = {
        class: 'leave',
        label: 'Leave',
        func: function () {
            // remove the current message window
            messageWindow.remove();

            // display message confirming to user that they declined a rematch
            const msg = 'You declined a rematch.';
            messageWindow.showMessage(msg, false, 'refresh');
            // disableInputs(false);
            // send message to server that I have declined the rematch
            socket.emit('rematch', { player: username, rematch: false });
        }
    }

    const buttons = [btnRematch, btnLeave];

    if (opponent == 'Computer') {
        messageWindow.showMessage(msg, false, 'refresh');
    } else {
        messageWindow.showMessage(msg, false, buttons);
    }
}

function resetGame() {
    // remove the message window
    messageWindow.remove();
    rematch = null;
    opp_rematch = null;
    initBoard();
}

function removeRotateClass() {
    const pieces = document.querySelectorAll('.gamePiece');
    pieces.forEach((piece) => {
        // void piece.offsetWidth;
        piece.style.transitionDelay = 0;
        piece.classList.remove('rotate');
    })
}

function enableInput() {
    inputActive = true;
    body.classList.remove('disableCursor');
    console.log('enable input');
    const piece = document.querySelector('.addedPiece');
    if (piece) piece.classList.remove('addedPiece');
}

function disableInput() {
    inputActive = false;
    body.classList.add('disableCursor');
    console.log('disable input');
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

function updateRematchStatus(oppStatus) {

    // opponent has declined a rematch
    if (!oppStatus) {
        messageWindow.remove();
        const msg = 'Your opponent declined a rematch.';
        messageWindow.showMessage(msg, 'refresh');
        clearBoard();
    } else {
        // if I have already also said yes to a rematch, reset them
        if (rematch) {
            messageWindow.remove();
            const msg = 'Rematch is on!';
            messageWindow.showMessage(msg, false, 'none');
            setTimeout(resetGame, 2000);
        } else {
            // i have not yet made a decision on whether to rematch, so I need to store
            // that my opponent wants a rematch
            opp_rematch = true;
        }
    }
}

gameBoard.addEventListener('transitionend', (event) => {
    const target = event.target;
    if (target.classList.contains('rotate')) {
        target.classList.remove('rotate');
    }
})

// gameBoard.addEventListener('transitionstart', (event) => {
//     const target = event.target;
//     if (target.classList.contains('rotate')) {
//         console.log('ping');
//         ping.play();
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

// volumeSlider.addEventListener('change', () => {
//     // get the current value
//     volume = 0.01 * volumeSlider.value;
//     updateVolumeSettings();
// })

// volumeSymbol.addEventListener('click', () => {
//     if (volume > 0) {
//         lastVolume = volume;
//         volume = 0;
//         volumeSlider.value = 0;
//     } else {
//         volume = lastVolume;
//         volumeSlider.value = volume * 100;
//     }
//     updateVolumeSettings();
// })

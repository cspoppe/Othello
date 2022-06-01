importScripts('/static/abFuncsMover.js');

self.addEventListener('message', function (e) {
    const nMovesAhead = e.data[0];
    const turn = e.data[1];
    const board = e.data[2];

    const m = alphabeta(nMovesAhead, turn, board);


    self.postMessage(m);
})
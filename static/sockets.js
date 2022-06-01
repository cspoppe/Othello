var socket;

socket = io('http://' + document.domain + ':' + location.port + '/game');
// socket = io();
console.log('Game page loaded.');

socket.on('connect', () => {
    socket.emit('join', { data: 'I am connected' });
});

socket.on('status', (data) => {
    console.log('status');
    var playerNames = document.querySelector('.players');
    playerNames.innerText = data.username;
});
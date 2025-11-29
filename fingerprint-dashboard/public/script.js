const socket = io();
const logsDiv = document.getElementById('logs');

function addLog(entry) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = JSON.stringify(entry);
    logsDiv.prepend(div);
}

socket.on('logs', data => {
    logsDiv.innerHTML = '';
    data.reverse().forEach(addLog);
});

socket.on('access', addLog);
socket.on('enrollment', addLog);
socket.on('event', addLog);
socket.on('heartbeat', addLog);

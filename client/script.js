/*
 This file contains the following functionalities:
  
  1. WebSocket Setup and Handlers: Initializes the WebSocket connection using Socket.io and defines message handlers for different events, including game updates, player moves, and game over notifications.
  
  2. Game Movement Logic: Implements functions to handle player movements, including updating the game state, emitting player move events, and handling direction changes.
  
  3. Game Over Handling: Defines the logic to handle game over scenarios, including displaying the game over message and triggering celebration effects.
  
  4. Celebration Effects: Includes functions to display celebration effects, such as confetti or balloons, upon game completion.
  
  5. Event Listeners: Sets up event listeners for user interactions, such as sending chat messages and initiating moves, which interact with the WebSocket server.
  
 */


let ws;
let gameState;
let selectedCharacter = null;

window.onload = () => {
    ws = new WebSocket('ws://localhost:8000');

    ws.onopen = () => {
        console.log('Connected to server');
    };

    ws.onmessage = (message) => {
        const parsedMessage = JSON.parse(message.data);
        handleServerMessage(parsedMessage);
    };

    document.getElementById('new-game').onclick = () => {
        ws.send(JSON.stringify({ type: 'restartGame' }));
        document.getElementById('game-over').style.display = 'none';
        document.getElementById('history-list').innerHTML = '';
        displayMessage('New game started!');
    };

    document.getElementById('send-chat').onclick = () => {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value;
        if (message.trim()) {
            ws.send(JSON.stringify({ type: 'chat', data: { message } }));
            chatInput.value = '';
        }
    };
};

function handleServerMessage(message) {
    switch (message.type) {
        case 'gameState':
            updateGameState(message.data);
            break;
        case 'invalidMove':
            displayMessage(message.data.message);
            break;
        case 'gameOver':
            handleGameOver(message.data.winner);
            break;
        case 'chat':
            displayChatMessage(message.data.player, message.data.message);
            break;
    }
}

function displayChatMessage(player, message) {
    const chatList = document.getElementById('chat-list');
    const listItem = document.createElement('li');
    listItem.textContent = `${player}: ${message}`;
    chatList.appendChild(listItem);
}

function updateGameState(state) {
    gameState = state;
    updateBoard();
    document.getElementById('current-player').textContent = `Current Player: ${gameState.currentPlayer}`;
    resetMoveControls();
    displayMessage('');
}

function updateBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            const character = gameState.board[i][j];
            if (character) {
                cell.textContent = character;
                if (character.startsWith('A')) {
                    cell.classList.add('playerA');
                } else if (character.startsWith('B')) {
                    cell.classList.add('playerB');
                }
                if (character[0] === gameState.currentPlayer) {
                    cell.onclick = () => selectCharacter(i, j);
                } else {
                    cell.style.cursor = 'not-allowed';
                }
            }
            board.appendChild(cell);
        }
    }
}

function selectCharacter(x, y) {
    const character = gameState.board[x][y];
    if (character && character[0] === gameState.currentPlayer) {
        selectedCharacter = { x, y, type: character.split('-')[1] };
        showMoveControls();
    }
}

function showMoveControls() {
    const controls = document.getElementById('move-controls');
    controls.innerHTML = '';

    const directions = getValidMoves(selectedCharacter.type);
    directions.forEach(direction => {
        const button = document.createElement('button');
        button.textContent = direction;
        button.onclick = () => makeMove(direction);
        controls.appendChild(button);
    });
}


document.getElementById('new-game').addEventListener('click', startCelebration);
function getValidMoves(type) {
    switch (type) {
        case 'P1': case 'P2': case 'P3':
            return ['L', 'R', 'F', 'B'];
        case 'H1':
            return ['L', 'R', 'F', 'B'];
        case 'H2':
            return ['FL', 'FR', 'BL', 'BR'];
        case 'H3':
            return ['FL', 'FR', 'BL', 'BR', 'RF', 'RB', 'LF', 'LB'];
        default:
            return [];
    }
}

function makeMove(direction) {
    if (selectedCharacter) {
        ws.send(JSON.stringify({
            type: 'move',
            data: {
                player: gameState.currentPlayer,
                character: selectedCharacter.type,
                direction
            }
        }));
        addToHistory(selectedCharacter.type, direction);
    }
}

function resetMoveControls() {
    document.getElementById('move-controls').innerHTML = '';
}

function displayMessage(message) {
    document.getElementById('game-messages').textContent = message;
}

function addToHistory(character, direction) {
    const historyList = document.getElementById('history-list');
    const listItem = document.createElement('li');
    listItem.textContent = `${gameState.currentPlayer}-${character}: ${direction}`;
    historyList.appendChild(listItem);
}
function startCelebration() {
    const celebration = document.getElementById('celebration');
    celebration.style.display = 'block';
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = getRandomColor();
        confetti.style.animationDelay = Math.random() * 3 + 's';
        celebration.appendChild(confetti);
    }
    
    setTimeout(() => {
        celebration.innerHTML = ''; 
        celebration.style.display = 'none';
    }, 5000);
}

function getRandomColor() {
    const colors = ['#e67e22', '#2980b9', '#2ecc71', '#f39c12', '#9b59b6', '#e74c3c'];
    return colors[Math.floor(Math.random() * colors.length)];
}

document.getElementById('new-game').addEventListener('click', startCelebration);


function handleGameOver(winner) {
    document.getElementById('winner-announcement').textContent = 'Player '+winner+' wins!';
    document.getElementById('game-over').style.display = 'block';
    displayMessage('Game over! Player ' + winner + ' wins!');
    startCelebration();
    disableGameBoard();
}

function disableGameBoard() {
    const board = document.getElementById('game-board');
    const cells = board.getElementsByClassName('cell');
    for (let cell of cells) {
        cell.style.pointerEvents = 'none';  // Disable clicks on the board
    }
}

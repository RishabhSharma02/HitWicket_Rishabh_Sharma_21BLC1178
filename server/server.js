/*
 This file contains the following functionalities:
  
  1. WebSocket Setup and Handlers: Initializes the WebSocket connection using Socket.io and defines message handlers for different events, including game updates, player moves, and game over notifications.
  
  2. Game Movement Logic: Implements functions to handle player movements, including updating the game state, emitting player move events, and handling direction changes.
  
  3. Game Over Handling: Defines the logic to handle game over scenarios, including displaying the game over message and triggering celebration effects.
  
  4. Celebration Effects: Includes functions to display celebration effects, such as confetti or balloons, upon game completion.
  
  5. Event Listeners: Sets up event listeners for user interactions, such as sending chat messages and initiating moves, which interact with the WebSocket server.
  
 */


const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const app = express();
const port = process.env.PORT || 8000;
const server = http.createServer(app);
app.use(express.static('public'));

const wss = new WebSocket.Server({ server });

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


wss.on('connection', (ws) => {
    console.log('A new player connected');

    ws.send(JSON.stringify({
        type: 'gameState',
        data: gameState
    }));

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            console.log('Received message:', parsedMessage);
            if (parsedMessage.type === 'restartGame') {
                resetGameToInitialState();
            } else if (parsedMessage.type === 'chat') {
                broadcast({
                    type: 'chat',
                    data: {
                        player: gameState.currentPlayer,
                        message: parsedMessage.data.message
                    }
                });
            } else {
                serverMessageHandler(parsedMessage, ws);
            }
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('A player disconnected');
    });
});

function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

function resetGameToInitialState() {
    initGame();
    broadCastCurrentGameStatus();
}

function broadCastCurrentGameStatus() {
    broadcast({
        type: 'gameState',
        data: gameState
    });
}
//Defining game object , basically an empty array of pieces and starting players as A
let gameState = {
    board: [],
    currentPlayer: 'A',
    players: {
        A: [],
        B: []
    },
    winner: null
};
//Initialize Game
function initGame() {
    gameState.board = Array(5).fill().map(() => Array(5).fill(null));
    gameState.currentPlayer = 'A';
    gameState.winner = null;

    gameState.players.A = [
        { type: 'P1', position: [0, 0] },
        { type: 'P2', position: [0, 1] },
        { type: 'H1', position: [0, 2] },
        { type: 'H2', position: [0, 3] },
        { type: 'P3', position: [0, 4] }
    ];

    gameState.players.B = [
        { type: 'P1', position: [4, 0] },
        { type: 'P2', position: [4, 1] },
        { type: 'H1', position: [4, 2] },
        { type: 'H2', position: [4, 3] },
        { type: 'H3', position: [4, 4] }
    ];

    gameState.players.A.forEach(character => {
        gameState.board[character.position[0]][character.position[1]] = `A-${character.type}`;
    });

    gameState.players.B.forEach(character => {
        gameState.board[character.position[0]][character.position[1]] = `B-${character.type}`;
    });

    console.log('Game initialized:', gameState);
}

//Initialize Game
initGame();
//
function serverMessageHandler(message, ws) {
    try {
        if (message.type === 'move') {
            const { player, character, direction } = message.data;

            if (player !== gameState.currentPlayer) {
                ws.send(JSON.stringify({
                    type: 'invalidMove',
                    data: { message: 'Not your turn' }
                }));
                return;
            }

            const result = processMove(player, character, direction);
            checkForGameEnd();

            if (!result.success) {
                ws.send(JSON.stringify({
                    type: 'invalidMove',
                    data: { message: result.message }
                }));
                return;
            }

            console.log('Move processed successfully:', result.message);
            broadCastCurrentGameStatus();
        }
    } catch (error) {
        console.error('Error processing client message:', error);
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'An error occurred processing your request.' }
        }));
    }
}


function checkForGameEnd() {
    const players = gameState.players;
    const piecesLeft = { A: 0, B: 0 };

    for (const player in players) {
        piecesLeft[player] = players[player].length;
    }
    //Simple logic if any of the members are with zero pieces , the one who is'nt wins
    console.log(piecesLeft)
    if (piecesLeft.A === 0) {
        gameState.winner = 'B';
    } else if (piecesLeft.B === 0) {
        gameState.winner = 'A';
    }

    if (gameState.winner) {
        broadCastCurrentGameStatus();
        broadcast({
            type: 'gameOver',
            data: { winner: gameState.winner }
        });
    }
}

//Main game logic , every move is checked wheather it's possible or not then the move is made.

function processMove(player, character, direction) {
    if (!isValidMove(player, character, direction)) {
        return { success: false, message: 'Invalid move' };
    }

    const playerCharacters = gameState.players[player];
    const characterData = playerCharacters.find(c => c.type === character);

    if (!characterData) {
        return { success: false, message: 'Character not found' };
    }

    const [x, y] = characterData.position;
    let newX = x;
    let newY = y;

    switch (character) {
        case 'P1': case 'P2': case 'P3':
            switch (direction) {
                case 'L': newY -= 1; break;
                case 'R': newY += 1; break;
                case 'F': newX += (player === 'A' ? 1 : -1); break;
                case 'B': newX -= (player === 'A' ? 1 : -1); break;
                default: return { success: false, message: 'Invalid direction' };
            }
            break;
        case 'H1':
            const opponent = player === 'A' ? 'B' : 'A';
            let steps;
            switch (direction) {
                case 'L':
                    steps = -1;
                    for (let i = y + steps; i > y + steps * 2; i += steps) {
                        if (gameState.board[x][i] && gameState.board[x][i][0] === (player === 'A' ? 'B' : 'A')) {
                            gameState.board[x][i] = null;
                            gameState.players[opponent] = gameState.players[opponent].filter(c => !(c.position[0] === x && c.position[1] === i));
                        }
                    }
                    newY += steps * 2;
                    break;
                case 'R':
                    steps = 1;
                    for (let i = y + steps; i < y + steps * 2; i += steps) {
                        if (gameState.board[x][i] && gameState.board[x][i][0] === (player === 'A' ? 'B' : 'A')) {
                            gameState.board[x][i] = null;
                            gameState.players[opponent] = gameState.players[opponent].filter(c => !(c.position[0] === x && c.position[1] === i));
                        }
                    }
                    newY += steps * 2;
                    break;
                case 'F':
                    steps = (player === 'A' ? 1 : -1);
                    for (let i = x + steps; i < x + steps * 2; i += steps) {
                        if (gameState.board[i][y] && gameState.board[i][y][0] === (player === 'A' ? 'B' : 'A')) {
                            gameState.board[i][y] = null;
                            gameState.players[opponent] = gameState.players[opponent].filter(c => !(c.position[0] === i && c.position[1] === y));
                        }
                    }
                    newX += steps * 2;
                    break;
                case 'B':
                    steps = (player === 'A' ? -1 : 1);
                    for (let i = x + steps; i > x + steps * 2; i += steps) {
                        if (gameState.board[i][y] && gameState.board[i][y][0] === (player === 'A' ? 'B' : 'A')) {
                            gameState.board[i][y] = null;
                            gameState.players[opponent] = gameState.players[opponent].filter(c => !(c.position[0] === i && c.position[1] === y));
                        }
                    }
                    newX += steps * 2;
                    break;
                default:
                    return { success: false, message: 'Invalid direction' };
            }
            break;
        case 'H2':
            const opposingPlayer = player === 'A' ? 'B' : 'A';
            let stepsX, stepsY;
            switch (direction) {
                case 'FL':
                    stepsX = (player === 'A' ? 1 : -1);
                    stepsY = -1;
                    for (let i = 1; i <= 2; i++) {
                        if (gameState.board[x + stepsX * i][y + stepsY * i] && gameState.board[x + stepsX * i][y + stepsY * i][0] === opposingPlayer) {
                            gameState.board[x + stepsX * i][y + stepsY * i] = null;
                            gameState.players[opposingPlayer] = gameState.players[opposingPlayer].filter(c => !(c.position[0] === x + stepsX * i && c.position[1] === y + stepsY * i));
                        }
                    }
                    newX += stepsX * 2;
                    newY += stepsY * 2;
                    break;
                case 'FR':
                    stepsX = (player === 'A' ? 1 : -1);
                    stepsY = 1;
                    for (let i = 1; i <= 2; i++) {
                        if (gameState.board[x + stepsX * i][y + stepsY * i] && gameState.board[x + stepsX * i][y + stepsY * i][0] === opposingPlayer) {
                            gameState.board[x + stepsX * i][y + stepsY * i] = null;
                            gameState.players[opposingPlayer] = gameState.players[opposingPlayer].filter(c => !(c.position[0] === x + stepsX * i && c.position[1] === y + stepsY * i));
                        }
                    }
                    newX += stepsX * 2;
                    newY += stepsY * 2;
                    break;
                case 'BL':
                    stepsX = (player === 'A' ? -1 : 1);
                    stepsY = -1;
                    for (let i = 1; i <= 2; i++) {
                        if (gameState.board[x + stepsX * i][y + stepsY * i] && gameState.board[x + stepsX * i][y + stepsY * i][0] === opposingPlayer) {
                            gameState.board[x + stepsX * i][y + stepsY * i] = null;
                            gameState.players[opposingPlayer] = gameState.players[opposingPlayer].filter(c => !(c.position[0] === x + stepsX * i && c.position[1] === y + stepsY * i));
                        }
                    }
                    newX += stepsX * 2;
                    newY += stepsY * 2;
                    break;
                case 'BR':
                    stepsX = (player === 'A' ? -1 : 1);
                    stepsY = 1;
                    for (let i = 1; i <= 2; i++) {
                        if (gameState.board[x + stepsX * i][y + stepsY * i] && gameState.board[x + stepsX * i][y + stepsY * i][0] === opposingPlayer) {
                            gameState.board[x + stepsX * i][y + stepsY * i] = null;
                            gameState.players[opposingPlayer] = gameState.players[opposingPlayer].filter(c => !(c.position[0] === x + stepsX * i && c.position[1] === y + stepsY * i));
                        }
                    }
                    newX += stepsX * 2;
                    newY += stepsY * 2;
                    break;
                default:
                    return { success: false, message: 'Invalid direction' };
            }
            break;

        case 'H3':
            switch (direction) {
                case 'FL': newX += (player === 'A' ? 2 : -2); newY -= 1; break;
                case 'FR': newX += (player === 'A' ? 2 : -2); newY += 1; break;
                case 'BL': newX -= (player === 'A' ? 2 : -2); newY -= 1; break;
                case 'BR': newX -= (player === 'A' ? 2 : -2); newY += 1; break;
                case 'RF': newX += 2; newY += (player === 'A' ? 1 : -1); break;
                case 'RB': newX += 2; newY -= (player === 'A' ? 1 : -1); break;
                case 'LF': newX -= 2; newY += (player === 'A' ? 1 : -1); break;
                case 'LB': newX -= 2; newY -= (player === 'A' ? 1 : -1); break;
                default: return { success: false, message: 'Invalid direction' };
            }
            break;

        default:
            return { success: false, message: 'Invalid character type' };
    }


    if (newX < 0 || newX >= 5 || newY < 0 || newY >= 5) {
        return { success: false, message: 'Move out of bounds' };
    }

    const opponent = player === 'A' ? 'B' : 'A';
    if (gameState.board[newX][newY] && gameState.board[newX][newY][0] === opponent) {
        console.log(`Capturing opponent's piece at [${newX}, ${newY}]`);
        gameState.players[opponent] = gameState.players[opponent].filter(c => !(c.position[0] === newX && c.position[1] === newY));
    }
    gameState.board[x][y] = null;
    gameState.board[newX][newY] = `${player}-${character}`;
    characterData.position = [newX, newY];

    console.log(`Character ${character} moved to [${newX}, ${newY}]`);
    if (gameState.players[opponent].length === 0) {
        gameState.winner = player;
        broadcastGameOver(player);
        return { success: true, message: `${player} wins the game!` };
    } else {
        gameState.currentPlayer = opponent;
    }

    return { success: true, message: 'Move processed successfully' };
}

//Validators for the moves

function isValidMove(player, character, direction) {
    const playerCharacters = gameState.players[player];
    const characterData = playerCharacters.find(c => c.type === character);

    if (!characterData) {
        return false;
    }

    const [x, y] = characterData.position;
    let newX = x;
    let newY = y;

    switch (character) {
        case 'P1': case 'P2': case 'P3': // Pawn moves one block in any direction
            switch (direction) {
                case 'L': newY -= 1; break;
                case 'R': newY += 1; break;
                case 'F': newX += (player === 'A' ? 1 : -1); break;
                case 'B': newX -= (player === 'A' ? 1 : -1); break;
                default: return false;
            }
            break;

        case 'H1': // Hero1 moves two blocks straight in any direction
            switch (direction) {
                case 'L': newY -= 2; break;
                case 'R': newY += 2; break;
                case 'F': newX += (player === 'A' ? 2 : -2); break;
                case 'B': newX -= (player === 'A' ? 2 : -2); break;
                default: return false;
            }
            break;

        case 'H2': // Hero2 moves two blocks diagonally in any direction
            switch (direction) {
                case 'FL': newX += (player === 'A' ? 2 : -2); newY -= 2; break;
                case 'FR': newX += (player === 'A' ? 2 : -2); newY += 2; break;
                case 'BL': newX -= (player === 'A' ? 2 : -2); newY -= 2; break;
                case 'BR': newX -= (player === 'A' ? 2 : -2); newY += 2; break;
                default: return false;
            }
            break;
        case 'H3':
            switch (direction) {
                case 'FL': newX += (player === 'A' ? 2 : -2); newY -= 1; break;
                case 'FR': newX += (player === 'A' ? 2 : -2); newY += 1; break;
                case 'BL': newX -= (player === 'A' ? 2 : -2); newY -= 1; break;
                case 'BR': newX -= (player === 'A' ? 2 : -2); newY += 1; break;
                case 'RF': newX += 2; newY += (player === 'A' ? 1 : -1); break;
                case 'RB': newX += 2; newY -= (player === 'A' ? 1 : -1); break;
                case 'LF': newX -= 2; newY += (player === 'A' ? 1 : -1); break;
                case 'LB': newX -= 2; newY -= (player === 'A' ? 1 : -1); break;
                default: return false;
            }
            break;
        default:
            return false;
    }

    if (newX < 0 || newX >= 5 || newY < 0 || newY >= 5) {
        console.log('Invalid move: Out of bounds');
        return false;
    }

    if (gameState.board[newX][newY] && gameState.board[newX][newY][0] === player) {
        console.log('Invalid move: Friendly fire');
        return false;
    }

    return true;
}

//function to sent current game status every time a move occurs
function broadCastCurrentGameStatus() {
    try {
        const gameStateMessage = JSON.stringify({
            type: 'gameState',
            data: gameState
        });

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(gameStateMessage);
            }
        });

        if (gameState.winner) {
            broadcastGameOver(gameState.winner);
        }
    } catch (error) {
        console.error('Error broadcasting game state:', error);
    }
}

//function to sendf Game over
function broadcastGameOver(winner) {
    const gameOverMessage = JSON.stringify({
        type: 'gameOver',
        data: { winner }
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(gameOverMessage);
        }
    });

    console.log(`Game over! Player ${winner} wins.`);
}

// Common helper to broadcast message
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

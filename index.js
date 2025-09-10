// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const words = ['apple', 'car', 'house', 'tree', 'dog', 'computer', 'banana', 'rocket', 'guitar', 'pizza'];
const MAX_ROUNDS = 5;
let rooms = {};

function getNextDrawer(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return null;
  room.drawerIndex = (room.drawerIndex + 1) % room.players.length;
  return room.players[room.drawerIndex];
}

function startRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return;

  if (room.round >= MAX_ROUNDS) {
    io.to(roomId).emit('gameOver', {
      leaderboard: room.players.sort((a, b) => b.score - a.score)
    });
    return;
  }

  room.round += 1;
  const drawer = getNextDrawer(roomId);
  room.currentWord = words[Math.floor(Math.random() * words.length)];
  room.guessed = false;

  io.to(roomId).emit('startRound', {
    drawerId: drawer.id,
    drawerName: drawer.username,
    round: room.round,
    time: 60
  });

  io.to(drawer.id).emit('wordToDraw', room.currentWord);

  // Start timer
  let timeLeft = 60;
  const timer = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit('timer', timeLeft);

    if (timeLeft <= 0 || room.guessed) {
      clearInterval(timer);
      startRound(roomId);
    }
  }, 1000);
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        drawerIndex: -1,
        currentWord: '',
        round: 0,
        guessed: false
      };
    }

    rooms[roomId].players.push({ id: socket.id, username, score: 0 });
    io.to(roomId).emit('playerList', rooms[roomId].players);

    if (rooms[roomId].players.length === 1) {
      startRound(roomId);
    }
  });

  socket.on('guess', ({ roomId, guess, username }) => {
    const room = rooms[roomId];
    io.to(roomId).emit('newGuess', { guess, username });

    if (!room.guessed && guess.toLowerCase() === room.currentWord.toLowerCase()) {
      room.guessed = true;
      const guesser = room.players.find(p => p.id === socket.id);
      const drawer = room.players[room.drawerIndex];
      if (guesser) guesser.score += 10;
      if (drawer) drawer.score += 5;

      io.to(roomId).emit('correctGuess', { username, word: room.currentWord });
    }
  });

  socket.on('drawing', ({ roomId, data }) => {
    socket.to(roomId).emit('drawing', data);
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      io.to(roomId).emit('playerList', room.players);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

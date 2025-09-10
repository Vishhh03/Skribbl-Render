// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, username, score: 0 });

    io.to(roomId).emit('playerList', rooms[roomId]);
  });

  socket.on('drawing', ({ roomId, data }) => {
    socket.to(roomId).emit('drawing', data);
  });

  socket.on('guess', ({ roomId, guess, username }) => {
    io.to(roomId).emit('newGuess', { guess, username });
    // Add scoring logic here if needed
  });

  socket.on('disconnect', () => {
    for (let roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      io.to(roomId).emit('playerList', rooms[roomId]);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

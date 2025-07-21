// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let rooms = {};
const allWords = ["cat", "dog", "house", "tree", "car", "pizza", "phone", "ball", "star", "book"];

function createRoomIfNeeded(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      players: [],
      host: null,
      gameStarted: false,
      drawerIndex: 0,
      currentDrawer: null,
      currentWord: null,
      correctGuessers: new Set(),
      roundTimer: null,
      wordChoiceTimer: null,
      hintIndexes: [],
      startTime: null,
      totalRounds: 1,
      currentRound: 1,
    };
  }
}

function getRandomWords(num) {
  return [...allWords].sort(() => 0.5 - Math.random()).slice(0, num);
}

function revealHint(room) {
  const word = room.currentWord;
  if (!word) return "_ ".repeat(word.length).trim();

  const hintArr = word.split("").map((ch, i) =>
    room.hintIndexes.includes(i) ? ch : "_"
  );
  return hintArr.join(" ");
}

function startRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return;

  room.correctGuessers.clear();
  room.hintIndexes = [];

  const drawerPlayer = room.players[room.drawerIndex];
  room.currentDrawer = drawerPlayer.username;

  const choices = getRandomWords(3);
  io.to(roomId).fetchSockets().then((sockets) => {
    const drawerSocket = sockets.find(s => s.id === drawerPlayer.id);
    if (drawerSocket) {
      drawerSocket.emit("wordChoices", choices);
    }
  });

  room.wordChoiceTimer = setTimeout(() => {
    room.currentWord = choices[0];
    io.to(room.players.find(p => p.username === room.currentDrawer).id).emit(
      "chatMessage",
      { username: "SYSTEM", message: `Auto-picked "${room.currentWord}".` }
    );
    beginDrawingPhase(roomId);
  }, 10000);
}

function beginDrawingPhase(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  clearTimeout(room.wordChoiceTimer);
  const drawer = room.currentDrawer;
  room.startTime = Date.now();
  let timeLeft = 60;

  io.to(roomId).emit("roundStarted", {
    drawer,
    hint: revealHint(room),
    time: timeLeft,
  });

  room.roundTimer = setInterval(() => {
    timeLeft--;

    // Reveal one new letter every 5 seconds below 20s
    if (timeLeft < 20 && timeLeft % 5 === 0) {
      const unrevealed = room.currentWord
        .split("")
        .map((_, i) => i)
        .filter(i => !room.hintIndexes.includes(i));

      if (unrevealed.length > 0) {
        const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        room.hintIndexes.push(randomIndex);
      }
    }

    io.to(roomId).emit("timerUpdate", {
      time: timeLeft,
      hint: revealHint(room),
    });

    if (timeLeft <= 0) {
      clearInterval(room.roundTimer);
      endRound(roomId);
    }
  }, 1000);
}

function endRound(roomId) {
  const room = rooms[roomId];
  io.to(roomId).emit("roundOver", {
    word: room.currentWord,
    scores: room.players.map(p => ({ username: p.username, score: p.score })),
  });

  room.drawerIndex++;
  if (room.drawerIndex >= room.players.length) {
    room.drawerIndex = 0;
    room.currentRound++;
  }

  const totalTurns = room.totalRounds * room.players.length;
  const turnsDone = (room.currentRound - 1) * room.players.length + room.drawerIndex;

  if (turnsDone >= totalTurns) {
    // Game Over
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    io.to(roomId).emit("gameOver", {
      leaderboard: sorted.map(p => ({ username: p.username, score: p.score })),
    });
    delete rooms[roomId];
  } else {
    setTimeout(() => startRound(roomId), 2000);
  }
}

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ roomId, username }) => {
    createRoomIfNeeded(roomId);
    const room = rooms[roomId];
    socket.join(roomId);
    room.players.push({ id: socket.id, username, score: 0 });
    if (!room.host) room.host = socket.id;

    io.to(roomId).emit("roomUpdate", {
      players: room.players.map(p => ({ username: p.username, score: p.score })),
      hostId: room.host,
      gameStarted: room.gameStarted,
    });
  });

  socket.on("startGame", ({ roomId, totalRounds }) => {
    const room = rooms[roomId];
    if (room && socket.id === room.host && !room.gameStarted) {
      room.totalRounds = totalRounds;
      room.gameStarted = true;
      io.to(roomId).emit("gameStarted");
      startRound(roomId);
    }
  });

  socket.on("chooseWord", ({ roomId, word }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.currentWord = word;
    beginDrawingPhase(roomId);
  });

  socket.on("guess", ({ roomId, guess, username }) => {
    const room = rooms[roomId];
    if (!room || !room.currentWord || room.currentDrawer === username) return;

    const player = room.players.find(p => p.username === username);
    if (!player || room.correctGuessers.has(username)) return;

    if (guess.toLowerCase() === room.currentWord.toLowerCase()) {
      const elapsed = Math.floor((Date.now() - room.startTime) / 1000);
      const points = Math.max(50, 300 - elapsed * 5);
      player.score += points;
      room.correctGuessers.add(username);

      io.to(roomId).emit("newGuess", {
        username,
        guess: "guessed the word correctly!",
        correct: true
      });

      if (room.correctGuessers.size === room.players.length - 1) {
        clearInterval(room.roundTimer);
        endRound(roomId);
      }
    } else {
      io.to(roomId).emit("newGuess", { username, guess, correct: false });
    }
  });

  socket.on("draw", ({ roomId, x, y, color, size }) => {
    socket.to(roomId).emit("draw", { x, y, color, size });
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex(p => p.id === socket.id);

      if (index !== -1) {
        const wasHost = socket.id === room.host;
        room.players.splice(index, 1);
        if (wasHost && room.players.length > 0) room.host = room.players[0].id;
        if (room.players.length === 0) {
          clearInterval(room.roundTimer);
          clearTimeout(room.wordChoiceTimer);
          delete rooms[roomId];
        } else {
          io.to(roomId).emit("roomUpdate", {
            players: room.players.map(p => ({ username: p.username, score: p.score })),
            hostId: room.host,
            gameStarted: room.gameStarted,
          });
        }
        break;
      }
    }
  });
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));




// App.js
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import Canvas from "./Canvas";
import "./App.css";

const socket = io("https://playlienzo.onrender.com");

function App() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [isDrawer, setIsDrawer] = useState(false);
  const [wordChoices, setWordChoices] = useState([]);
  const [hint, setHint] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [guess, setGuess] = useState("");
  const [messages, setMessages] = useState([]);
  const [totalRounds, setTotalRounds] = useState(1);
  const [leaderboard, setLeaderboard] = useState(null);

  const guessInputRef = useRef();

  useEffect(() => {
    socket.on("roomUpdate", ({ players, hostId, gameStarted }) => {
      setPlayers(players);
      setHostId(hostId);
      setGameStarted(gameStarted);
    });

    socket.on("gameStarted", () => {
      setGameStarted(true);
    });

    socket.on("wordChoices", (choices) => {
      setWordChoices(choices);
      setIsDrawer(true);
    });

    socket.on("roundStarted", ({ drawer, hint, time }) => {
      setIsDrawer(drawer === username);
      setWordChoices([]);
      setHint(hint);
      setTimeLeft(time);
    });

    socket.on("timerUpdate", ({ time, hint }) => {
      setTimeLeft(time);
      setHint(hint);
    });

    socket.on("roundOver", ({ word, scores }) => {
      setMessages((prev) => [
        ...prev,
        { username: "SYSTEM", guess: `The word was "${word}".` },
      ]);
      setPlayers(scores);
    });

    socket.on("newGuess", ({ username, guess, correct }) => {
      setMessages((prev) => [...prev, { username, guess, correct }]);
    });

    socket.on("gameOver", ({ leaderboard }) => {
      setLeaderboard(leaderboard);
    });

    return () => {
      socket.off();
    };
  }, [username]);

  const handleJoin = () => {
    if (roomId && username) {
      socket.emit("joinRoom", { roomId, username });
      setJoined(true);
    }
  };

  const handleStartGame = () => {
    socket.emit("startGame", { roomId, totalRounds });
  };

  const handleGuess = () => {
    if (guess.trim()) {
      socket.emit("guess", { roomId, guess, username });
      setGuess("");
      guessInputRef.current?.focus();
    }
  };

  const chooseWord = (word) => {
    socket.emit("chooseWord", { roomId, word });
  };

  return (
    <div className="App">
      {!joined ? (
        <div className="join-container">
          <h2>Join Game</h2>
          <input placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={handleJoin}>Join</button>
        </div>
      ) : leaderboard ? (
        <div className="leaderboard">
          <h2>Leaderboard</h2>
          <ul>
            {leaderboard.map((p, i) => (
              <li key={i}>{p.username}: {p.score} pts</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="game-container">
          <div className="canvas-area">
            <Canvas socket={socket} roomId={roomId} isDrawer={isDrawer} />
            <p className="hint">Hint: {hint} | Time Left: {timeLeft}</p>
          </div>
          <div className="sidebar">
            <h3>Players</h3>
            <div className="player-list">
              {players.map((p, i) => (
                <p key={i}>{p.username} - {p.score} pts</p>
              ))}
            </div>
            {hostId === socket.id && !gameStarted && (
              <div>
                <input
                  type="number"
                  min="1"
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Number(e.target.value))}
                />
                <button onClick={handleStartGame}>Start Game</button>
              </div>
            )}
            <div className="guess-section">
              {!isDrawer && (
                <>
                  <input
                    ref={guessInputRef}
                    placeholder="Enter your guess"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                  />
                  <button onClick={handleGuess}>Submit Guess</button>
                </>
              )}
              {wordChoices.length > 0 && (
                <div className="word-choices">
                  <p>Pick a word:</p>
                  {wordChoices.map((word, i) => (
                    <button key={i} onClick={() => chooseWord(word)}>{word}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="chat-log">
              {messages.map((msg, i) => (
                <p key={i} style={{ color: msg.correct ? "green" : "black" }}>
                  <strong>{msg.username}</strong>: {msg.guess}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

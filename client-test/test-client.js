const { io } = require("socket.io-client");

// Connect to your backend
const socket = io("http://localhost:3001");

socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);

    // Send a fake drawing event after 2 seconds
    setTimeout(() => {
        socket.emit("draw", { x: 100, y: 200, color: "red" });
        console.log("Sent a draw event");
    }, 2000);
});

// Listen for "draw" events from other clients
socket.on("draw", (data) => {
    console.log("Received draw data:", data);
});

socket.on("disconnect", () => {
    console.log("Disconnected from server");
});

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// 🔥 Only ONE room
const ROOM_ID = "global-room";

const room = {
    players: []
};

let currentWord = "";

let currentDrawer = null;

let timer = 60;
let interval = null;

let round = 0;

let maxRounds = 5;

let turnQueue = []; // 🔥 stores player order

let drawingHistory = [];

let reconnectTimeouts = {}; // 🔥 track reconnect timers

let gameRestarting = false;

let lastWords = [];

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

async function generateWord() {
    try {
        const model = genAI.getGenerativeModel({
            model: "models/gemini-2.5-flash"
        });

        let word = "";

        let attempts = 0;

        do {
            const result = await model.generateContent(
                `Give one simple word for a drawing game it can be a non living thing or a living thing also don't repeat the words for next 5 times. Only return ONE word.`
            );

            word = result.response.text().trim();
            word = word.replace(/[^a-zA-Z]/g, "").toLowerCase();

            attempts++;

        } while (lastWords.includes(word) && attempts < 5);

        // 🔥 Store word
        lastWords.push(word);

        // Keep only last 5
        if (lastWords.length > 5) {
            lastWords.shift();
        }

        return word || "cat";

    } catch (err) {
        console.log("Gemini error:", err.message);
        return "cat";
    }
}

async function startGame() {
    turnQueue = [...room.players]; // copy players
    round = 0;

    await nextTurn();
}

async function nextTurn() {

    if (round >= turnQueue.length) {
        io.to(ROOM_ID).emit("game_over", room.players);
        currentDrawer = null;
        return;
    }

    currentDrawer = turnQueue[round];
    round++;

    // 🔥 AI word
    currentWord = await generateWord();

    io.to(ROOM_ID).emit("drawer_selected", {
        drawerId: currentDrawer.id,
        drawerName: currentDrawer.name,
        round
    });

    io.to(currentDrawer.id).emit("your_word", currentWord);

    io.to(ROOM_ID).emit("clear_canvas");

    startTimer();
}

function startTimer() {
    timer = 60;

    if (interval) clearInterval(interval);

    interval = setInterval(async () => {
        timer--;

        io.to(ROOM_ID).emit("timer_update", timer);

        if (timer <= 0) {
            clearInterval(interval);
            await nextTurn(); // 🔥 go to next player
        }
    }, 1000);
}

function resetGame() {
    currentDrawer = null;
    currentWord = "";
    round = 0;
    timer = 60;
    drawingHistory = [];
    turnQueue = [];

    // ❗ Reset scores (optional)
    room.players = room.players.map(p => ({
        ...p,
        score: 0
    }));
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_room", ({ username }) => {

        // ✅ cancel disconnect removal
        if (reconnectTimeouts[username]) {
            clearTimeout(reconnectTimeouts[username]);
            delete reconnectTimeouts[username];
        }

        const existingPlayer = room.players.find(p => p.name === username);

        if (existingPlayer) {
            // 🔥 update socket id (THIS FIXES DRAWER BUG)
            existingPlayer.id = socket.id;
        } else {
            if (room.players.length >= 5) {
                socket.emit("room_full");
                return;
            }

            room.players.push({
                id: socket.id,
                name: username,
                score: 0
            });
        }

        // 🔥 Sync turnQueue IDs after reconnect
        turnQueue = turnQueue.map(p => {
            if (p.name === username) {
                return { ...p, id: socket.id };
            }
            return p;
        });

        socket.join(ROOM_ID);

        // 🔥 START GAME WHEN ENOUGH PLAYERS
        if (room.players.length === 5 && !currentDrawer && turnQueue.length === 0) {
            startGame();
        }

        // 🔥 VERY IMPORTANT: restore drawer identity
        if (currentDrawer && currentDrawer.name === username) {
            currentDrawer.id = socket.id;
        }

        // if (room.players.length < 5) {
        //     return; // wait for more players
        // }

        // 🔥 send current game state
        socket.emit("game_state", {
            players: room.players,
            drawer: currentDrawer,
            word: currentWord,
            timer: timer
        });

        io.to(ROOM_ID).emit("room_update", room.players);
    });

    socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const wasDrawer = currentDrawer?.id === socket.id;

        // ⏳ WAIT before removing (important)
        reconnectTimeouts[player.name] = setTimeout(async () => {

            // 🔥 remove only if NOT reconnected
            room.players = room.players.filter(p => p.name !== player.name);
            turnQueue = turnQueue.filter(p => p.name !== player.name);

            if (wasDrawer) {
                clearInterval(interval);
                currentDrawer = null;

                if (room.players.length > 0) {
                    await nextTurn();
                }
            }

            io.to(ROOM_ID).emit("room_update", room.players);

        }, 5000); // 5 seconds grace
    });

    socket.on("draw", (data) => {
        if (!currentDrawer) return;
        if (socket.id !== currentDrawer.id) return;

        drawingHistory.push(data); // ✅ store

        socket.to(ROOM_ID).emit("draw", data);
    });

    socket.on("send_message", async ({ username, message }) => {

        // ❌ Drawer cannot send messages
        if (socket.id === currentDrawer?.id) return;

        if (message.toLowerCase() === currentWord) {

            const player = room.players.find(p => p.name === username);

            if (player) {
                player.score += 10;
            }

            io.to(ROOM_ID).emit("correct_guess", {
                username,
                message
            });

            io.to(ROOM_ID).emit("room_update", room.players);

            clearInterval(interval);
            await nextTurn();

        } else {
            io.to(ROOM_ID).emit("receive_message", {
                username,
                message
            });
        }
    });

    socket.on("send_emoji", (emoji) => {
        io.to(ROOM_ID).emit("receive_emoji", {
            emoji,
            user: socket.id
        });
    });

    socket.on("play_again", () => {
        if (gameRestarting) return;

        gameRestarting = true;

        resetGame();
        io.to(ROOM_ID).emit("restart_game");
        startGame();

        setTimeout(() => {
            gameRestarting = false;
        }, 2000);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
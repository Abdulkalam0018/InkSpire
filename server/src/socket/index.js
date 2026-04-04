import { Server as SocketIOServer } from "socket.io";
import socketAuth from "../middleware/socketAuth.js";
import { createLobbyStore } from "../lobby/lobbyStore.js" 
import { handleLobbyEvents } from "../lobby/lobby.controller.js";
import { createGameStore, handleGameEvents } from "../game/game.controller.js";

export default function initSocket(httpServer) {
    const allowedOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
        : ["http://localhost:5173"];


    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                return callback(new Error("Not allowed by Socket.IO CORS"));
            },
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ["websocket", "polling"],
    });

    // Create a single lobby store instance to be shared across all sockets
    const lobbyStore = createLobbyStore();
    const gameStore = createGameStore();

    io.use(socketAuth);

    io.on("connection", (socket) => {
        socket.on("client:ping", () => {
            console.log("Received ping from client");
            socket.emit("server:pong");
        });

        handleLobbyEvents(io, socket, lobbyStore, gameStore);
        handleGameEvents(io, socket, lobbyStore, gameStore);

        socket.on("disconnect", (reason) => {
            console.log(`Socket ${socket.id} disconnected:`, reason);
        });
    });

  return io;
}

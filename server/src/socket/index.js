import { Server as SocketIOServer } from "socket.io";
import socketAuth from "../middleware/socketAuth.js";
import { SYSTEM_EVENTS } from "../shared/events/index.js";
import { createLobbyModule, createLobbyStore } from "../lobby/index.js";
import { createGameModule, createGameStore } from "../game/index.js";

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

    const lobbyStore = createLobbyStore();
    const gameStore = createGameStore();
    const lobbyModule = createLobbyModule({ io, lobbyStore, gameStore });
    const gameModule = createGameModule({ io, lobbyStore, gameStore });

    io.use(socketAuth);

    io.on("connection", (socket) => {
        socket.on(SYSTEM_EVENTS.CLIENT_PING, () => {
            console.log("Received ping from client");
            socket.emit(SYSTEM_EVENTS.SERVER_PONG);
        });

        lobbyModule.attachHandlers(socket);
        gameModule.attachHandlers(socket);

        socket.on("disconnect", (reason) => {
            console.log(`Socket ${socket.id} disconnected:`, reason);
        });
    });

  return io;
}

import "dotenv/config";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { createLobbyStore } from "./lobby/lobbyStore.js";

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  const lobbyStore = createLobbyStore();

  function getUserFromSocket(socket) {
    // Accept JWT from either socket auth or Authorization header.
    const authToken = socket.handshake.auth?.token;
    const header = socket.handshake.headers?.authorization || "";
    const headerToken = header.startsWith("Bearer ") ? header.slice(7) : null;
    const token = authToken || headerToken;

    if (!token || !process.env.JWT_SECRET) return null;

    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return null;
    }
  }

  function buildMember(socket, displayName) {
    const user = socket.data.user;
    const fallbackName = `Guest-${socket.id.slice(0, 4)}`;
    const name =
      typeof displayName === "string" && displayName.trim()
        ? displayName.trim()
        : user?.name || fallbackName;

    return {
      socketId: socket.id,
      userId: user?.id || null,
      name
    };
  }

  function emitLobbyState(lobby) {
    io.to(lobby.id).emit("lobby:state", lobbyStore.serializeLobby(lobby));
  }

  function emitLobbyError(socket, ack, message) {
    socket.emit("lobby:error", { message });
    if (typeof ack === "function") {
      ack({ ok: false, error: message });
    }
  }

  function leaveLobbyById(socket, lobbyId) {
    if (!lobbyId) return;
    const result = lobbyStore.removeMember(lobbyId, socket.id);
    socket.leave(lobbyId);

    if (socket.data.lobbyId === lobbyId) {
      socket.data.lobbyId = null;
    }

    if (result?.lobby) {
      emitLobbyState(result.lobby);
    }
  }

  io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    const authUser = getUserFromSocket(socket);
    socket.data.user = {
      id: authUser?.sub || authUser?.id || null,
      email: authUser?.email || null,
      name: authUser?.name || null
    };

    socket.emit("server:hello", { message: "Hello from server" });
    socket.on("client:ping", () => socket.emit("server:pong"));

    // Lobby socket events (create/join/leave/update).
    socket.on("lobby:create", (payload = {}, ack) => {
      const previousLobbyId = socket.data.lobbyId;
      const owner = buildMember(socket, payload.displayName);
      const lobby = lobbyStore.createLobby(payload.settings, owner);

      socket.join(lobby.id);
      socket.data.lobbyId = lobby.id;

      if (previousLobbyId && previousLobbyId !== lobby.id) {
        leaveLobbyById(socket, previousLobbyId);
      }

      emitLobbyState(lobby);

      if (typeof ack === "function") {
        ack({ ok: true, lobbyId: lobby.id });
      }
    });

    socket.on("lobby:join", (payload = {}, ack) => {
      const lobbyId =
        typeof payload.lobbyId === "string" ? payload.lobbyId.trim().toUpperCase() : "";

      if (!lobbyId) {
        emitLobbyError(socket, ack, "Lobby code is required");
        return;
      }

      const member = buildMember(socket, payload.displayName);
      const joinResult = lobbyStore.addMember(lobbyId, member);

      if (joinResult?.error) {
        emitLobbyError(socket, ack, joinResult.error);
        return;
      }

      const previousLobbyId = socket.data.lobbyId;
      socket.join(lobbyId);
      socket.data.lobbyId = lobbyId;

      if (previousLobbyId && previousLobbyId !== lobbyId) {
        leaveLobbyById(socket, previousLobbyId);
      }

      emitLobbyState(joinResult.lobby);

      if (typeof ack === "function") {
        ack({ ok: true, lobbyId });
      }
    });

    socket.on("lobby:leave", (_payload, ack) => {
      const lobbyId = socket.data.lobbyId;
      if (!lobbyId) {
        emitLobbyError(socket, ack, "You are not in a lobby");
        return;
      }

      leaveLobbyById(socket, lobbyId);
      socket.emit("lobby:left", { ok: true });

      if (typeof ack === "function") {
        ack({ ok: true });
      }
    });

    socket.on("lobby:updateSettings", (payload = {}, ack) => {
      const lobbyId =
        typeof payload.lobbyId === "string" && payload.lobbyId.trim()
          ? payload.lobbyId.trim().toUpperCase()
          : socket.data.lobbyId;

      if (!lobbyId) {
        emitLobbyError(socket, ack, "Lobby code is required");
        return;
      }

      const result = lobbyStore.updateSettings(lobbyId, socket.id, payload.settings);

      if (result?.error) {
        emitLobbyError(socket, ack, result.error);
        return;
      }

      emitLobbyState(result.lobby);

      if (typeof ack === "function") {
        ack({ ok: true });
      }
    });

    socket.on("disconnect", () => {
      leaveLobbyById(socket, socket.data.lobbyId);
    });
  });

  server.listen(PORT, () => {
    console.log(`API listening on ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});

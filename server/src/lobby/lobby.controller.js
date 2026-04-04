export function handleLobbyEvents(io, socket, lobbyStore, gameStore) {

  function buildMember(displayName) {
    const user = socket.user; 
    const fallbackName = `Guest-${socket.id.slice(0, 4)}`;
    
    const name =
      typeof displayName === "string" && displayName.trim()
        ? displayName.trim()
        : user?.name || fallbackName;

    return {
      socketId: socket.id,
      userId: user?.clerkId || user?.id || null, 
      name
    };
  }

  function emitLobbyState(lobby) {
    io.to(lobby.id).emit("lobby:state", lobbyStore.serializeLobby(lobby));
  }

  function emitLobbyError(ack, message) {
    socket.emit("lobby:error", { message });
    if (typeof ack === "function") {
      ack({ ok: false, error: message });
    }
  }

  function leaveLobbyById(lobbyId) {
    if (!lobbyId) return;
    
    const result = lobbyStore.removeMember(lobbyId, socket.id);
    socket.leave(lobbyId);

    if (socket.data.lobbyId === lobbyId) {
      socket.data.lobbyId = null;
    }

    if (result?.lobby) {
      emitLobbyState(result.lobby);
    }

    if (result?.deleted && gameStore) {
      gameStore.removeGame(lobbyId);
    }
  }

  socket.on("lobby:create", (payload = {}, ack) => {
    const previousLobbyId = socket.data.lobbyId;
    const owner = buildMember(payload.displayName);
    const lobby = lobbyStore.createLobby(payload.settings, owner);

    socket.join(lobby.id);
    socket.data.lobbyId = lobby.id;

    if (previousLobbyId && previousLobbyId !== lobby.id) {
      leaveLobbyById(previousLobbyId);
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
      emitLobbyError(ack, "Lobby code is required");
      return;
    }

    const member = buildMember(payload.displayName);
    const joinResult = lobbyStore.addMember(lobbyId, member);

    if (joinResult?.error) {
      emitLobbyError(ack, joinResult.error);
      return;
    }

    const previousLobbyId = socket.data.lobbyId;
    socket.join(lobbyId);
    socket.data.lobbyId = lobbyId;

    if (previousLobbyId && previousLobbyId !== lobbyId) {
      leaveLobbyById(previousLobbyId);
    }

    emitLobbyState(joinResult.lobby);

    if (typeof ack === "function") {
      ack({ ok: true, lobbyId });
    }
  });

  socket.on("lobby:leave", (_payload, ack) => {
    const lobbyId = socket.data.lobbyId;
    
    if (!lobbyId) {
      emitLobbyError(ack, "You are not in a lobby");
      return;
    }

    leaveLobbyById(lobbyId);
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
      emitLobbyError(ack, "Lobby code is required");
      return;
    }

    const result = lobbyStore.updateSettings(lobbyId, socket.id, payload.settings);

    if (result?.error) {
      emitLobbyError(ack, result.error);
      return;
    }

    emitLobbyState(result.lobby);

    if (gameStore) {
      const existingGame = gameStore.getGame(result.lobby.id);
      if (existingGame) {
        gameStore.ensureGame(result.lobby.id, result.lobby);
      }
    }

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("disconnect", () => {
    leaveLobbyById(socket.data.lobbyId);
  });
}

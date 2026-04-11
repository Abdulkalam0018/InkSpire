const disconnectCleanupTimers = new Map();

export function handleLobbyEvents(io, socket, lobbyStore, gameStore) {
  const DEFAULT_DISCONNECT_TTL_MS = 2 * 60 * 1000;
  const configuredDisconnectTtlMs = Number.parseInt(process.env.LOBBY_DISCONNECT_TTL_MS || "", 10);
  const disconnectTtlMs =
    Number.isFinite(configuredDisconnectTtlMs) && configuredDisconnectTtlMs >= 0
      ? configuredDisconnectTtlMs
      : DEFAULT_DISCONNECT_TTL_MS;

  function timerKey(lobbyId, userId) {
    return `${lobbyId}:${userId}`;
  }

  function clearDisconnectCleanup(lobbyId, userId) {
    if (!lobbyId || !userId) return;

    const key = timerKey(lobbyId, userId);
    const timerId = disconnectCleanupTimers.get(key);
    if (!timerId) return;

    clearTimeout(timerId);
    disconnectCleanupTimers.delete(key);
  }

  function scheduleDisconnectCleanup(lobbyId, userId) {
    if (!lobbyId || !userId) return;

    clearDisconnectCleanup(lobbyId, userId);

    const key = timerKey(lobbyId, userId);
    const timerId = setTimeout(() => {
      disconnectCleanupTimers.delete(key);

      const lobby = lobbyStore.getLobby(lobbyId);
      if (!lobby) return;

      const member = lobby.members.get(userId);
      if (!member || member.isOnline) return;

      const result = lobbyStore.removeMember(lobbyId, userId);

      if (result?.lobby) {
        io.to(result.lobby.id).emit("lobby:state", lobbyStore.serializeLobby(result.lobby));
      }

      if (result?.deleted && gameStore) {
        gameStore.removeGame(lobbyId);
      }
    }, disconnectTtlMs);

    disconnectCleanupTimers.set(key, timerId);
  }

  function buildMember(displayName) {
    const user = socket.user; 
    // Fallback requires a client-generated auth ID to persist guests, or uses DB ID
    const userId = user?.clerkId || user?.id || socket.handshake.auth?.userId || `guest_${socket.id}`;
    const fallbackName = `Guest-${userId.slice(0, 6)}`;
    
    const name =
      typeof displayName === "string" && displayName.trim()
        ? displayName.trim()
        : user?.name || fallbackName;

    return {
      userId,
      currentSocketId: socket.id, // Stored for targeted routing
      name,
      isOnline: true // for reconnection handling
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

  function leaveLobbyById(lobbyId, userId) {
    if (!lobbyId || !userId) return;

    clearDisconnectCleanup(lobbyId, userId);
    
    const result = lobbyStore.removeMember(lobbyId, userId);
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
    const previousUserId = socket.data.userId;
    const owner = buildMember(payload.displayName);
    
    socket.data.userId = owner.userId; 
    const lobby = lobbyStore.createLobby(payload.settings, owner);

    socket.join(lobby.id);
    socket.data.lobbyId = lobby.id;

    if (previousLobbyId && previousLobbyId !== lobby.id) {
      leaveLobbyById(previousLobbyId, previousUserId);
    }

    emitLobbyState(lobby);

    if (typeof ack === "function") ack({ ok: true, lobbyId: lobby.id });
  });

  socket.on("lobby:join", (payload = {}, ack) => {
    const lobbyId =
      typeof payload.lobbyId === "string" ? payload.lobbyId.trim().toUpperCase() : "";

    if (!lobbyId) {
      emitLobbyError(ack, "Lobby code is required");
      return;
    }

    const member = buildMember(payload.displayName);
    socket.data.userId = member.userId; // Cache for easy access
    const joinResult = lobbyStore.addMember(lobbyId, member);

    if (joinResult?.error) {
      emitLobbyError(ack, joinResult.error);
      return;
    }

    clearDisconnectCleanup(lobbyId, member.userId);

    const previousLobbyId = socket.data.lobbyId;
    socket.join(lobbyId);
    socket.data.lobbyId = lobbyId;

    if (previousLobbyId && previousLobbyId !== lobbyId) {
      leaveLobbyById(previousLobbyId, member.userId);
    }

    emitLobbyState(joinResult.lobby);

    if (typeof ack === "function") ack({ ok: true, lobbyId });
  });

  socket.on("lobby:leave", (_payload, ack) => {
    const lobbyId = socket.data.lobbyId;
    const userId = socket.data.userId;
    
    if (!lobbyId) {
      emitLobbyError(ack, "You are not in a lobby");
      return;
    }

    leaveLobbyById(lobbyId, userId);
    socket.emit("lobby:left", { ok: true });

    if (typeof ack === "function") ack({ ok: true });
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

    const result = lobbyStore.updateSettings(lobbyId, socket.data.userId, payload.settings);

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

    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("disconnect", () => {
    const lobbyId = socket.data?.lobbyId;
    const userId = socket.data?.userId;
    if (!lobbyId || !userId) return;

    const lobby = lobbyStore.getLobby(lobbyId);
    if (!lobby) return;

    const member = lobby.members.get(userId);
    if (!member || member.currentSocketId !== socket.id) return;

    member.isOnline = false;
    emitLobbyState(lobby);
    scheduleDisconnectCleanup(lobbyId, userId);
    
    // Note: To handle reconnections, we mark the member as offline instead of removing them immediately.
    
    // const lobbyId = socket.data?.lobbyId;
    // const userId = socket.data?.userId;
    
    // if (lobbyId && userId) {
    //   const lobby = lobbyStore.getLobby(lobbyId);
    //   if (lobby && lobby.members.has(userId)) {
    //     lobby.members.get(userId).isOnline = false;
    //     emitLobbyState(lobby);
    //   }
    // }
  });
}
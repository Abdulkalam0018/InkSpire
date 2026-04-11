import {
  normalizeCanvasState,
  normalizeWordInput,
  pickWordOptions
} from "./game.config.js";
import {
  buildBaseState,
  buildScoreboard,
  clearAllTimers,
  getRemainingSec,
  personalizeState,
  pickNextPresenter,
  syncMembers
} from "./game.state.js";

export { createGameStore } from "./game.store.js";

export function handleGameEvents(io, socket, lobbyStore, gameStore) {
  function emitError(ack, message) {
    socket.emit("game:error", { message });
    if (typeof ack === "function") {
      ack({ ok: false, error: message });
    }
  }

  function resolveLobbyId(payload) {
    if (typeof payload?.lobbyId === "string" && payload.lobbyId.trim()) {
      return payload.lobbyId.trim().toUpperCase();
    }
    return socket.data?.lobbyId || "";
  }

  function getLobbyOrError(payload, ack) {
    const lobbyId = resolveLobbyId(payload);
    if (!lobbyId) {
      emitError(ack, "Lobby code is required");
      return null;
    }

    const lobby = lobbyStore.getLobby(lobbyId);
    if (!lobby) {
      emitError(ack, "Lobby not found");
      return null;
    }

    return lobby;
  }

  function requireLobbyMember(payload, ack) {
    const lobby = getLobbyOrError(payload, ack);
    if (!lobby) return null;

    const userId = socket.data?.userId;
    if (!userId) {
      emitError(ack, "Unauthorized: missing user identity");
      return null;
    }

    if (socket.data?.lobbyId !== lobby.id) {
      emitError(ack, "Unauthorized: socket is not joined to this lobby");
      return null;
    }

    const member = lobby.members.get(userId);
    if (!member) {
      emitError(ack, "Unauthorized: you are not a member of this lobby");
      return null;
    }

    if (member.currentSocketId !== socket.id) {
      emitError(ack, "Unauthorized: socket does not match lobby membership");
      return null;
    }

    return { lobby, member };
  }

  function requireLobbyAdmin(payload, ack, errorMessage = "Only the lobby admin can perform this action") {
    const context = requireLobbyMember(payload, ack);
    if (!context) return null;

    if (context.lobby.adminUserId !== context.member.userId) {
      emitError(ack, errorMessage);
      return null;
    }

    return context;
  }

  function requirePresenter(game, ack, errorMessage = "Only the presenter can perform this action") {
    if (socket.data?.userId !== game.presenterUserId) {
      emitError(ack, errorMessage);
      return false;
    }

    return true;
  }

  function getActiveMemberIds(lobby) {
    const active = [];
    for (const member of lobby.members.values()) {
      if (member.isOnline) {
        active.push(member.userId);
      }
    }
    return active;
  }

  function getActiveGuesserIds(lobby, game) {
    return getActiveMemberIds(lobby).filter((userId) => userId !== game.presenterUserId);
  }

  function hasEnoughActivePlayers(lobby, minimum = 2) {
    return getActiveMemberIds(lobby).length >= minimum;
  }

  function emitGameState(lobby, game, reason) {
    syncMembers(game, lobby);
    const baseState = buildBaseState(game, lobby, reason);

    for (const member of lobby.members.values()) {
      if (!member.isOnline) continue;
      const stateForMember = personalizeState(baseState, game, member.userId);
      // Route via currentSocketId found in Member object
      io.to(member.currentSocketId).emit("game:state", stateForMember);
    }
  }

  function emitGameStateToSocket(lobby, game, socket, reason) {
    syncMembers(game, lobby);
    const baseState = buildBaseState(game, lobby, reason);
    const stateForMember = personalizeState(baseState, game, socket.data.userId);
    io.to(socket.id).emit("game:state", stateForMember);
  }

  function emitCanvasState(lobby, game, reason) {
    io.to(lobby.id).emit("game:canvasState", {
      lobbyId: lobby.id,
      canvas: game.canvasState,
      version: game.canvasVersion,
      reason
    });
  }

  function emitCanvasStateToSocket(lobby, game, targetSocket, reason) {
    io.to(targetSocket.id).emit("game:canvasState", {
      lobbyId: lobby.id,
      canvas: game.canvasState,
      version: game.canvasVersion,
      reason
    });
  }

  function resetCanvas(lobby, game, reason) {
    game.canvasState = null;
    game.canvasVersion += 1;
    emitCanvasState(lobby, game, reason);
  }

  function emitPresenterOptions(lobby, game) {
    if (!game.presenterUserId) return;
    const presenter = lobby.members.get(game.presenterUserId);
    
    // Route 1-to-1 direct message using the stored socket ID
    if (presenter && presenter.isOnline) {
      io.to(presenter.currentSocketId).emit("game:presenter", {
        lobbyId: lobby.id,
        round: game.round,
        options: game.wordOptions
      });
    }
  }

  function beginPresenterSelection(lobby, game, reason) {
    clearAllTimers(game);

    const activeMemberIds = getActiveMemberIds(lobby);
    if (activeMemberIds.length < 2) {
      endGame(lobby, game, "insufficient-active-players");
      return;
    }

    game.status = "presenter-choosing";
    game.word = null;
    game.wordOptions = pickWordOptions(game.settings.wordBank, 3);
    game.guessedThisRound = new Set();
    game.roundStartedAt = null;
    game.roundEndsAt = null;
    game.presenterUserId = pickNextPresenter(lobby, game, activeMemberIds);
    if (!game.presenterUserId) {
      endGame(lobby, game, "insufficient-active-players");
      return;
    }
    game.lastRoundResult = null;

    emitGameState(lobby, game, reason);
    resetCanvas(lobby, game, "new-round");
    emitPresenterOptions(lobby, game);
  }

  function startRound(lobby, game, word) {
    clearAllTimers(game);
    game.word = word;
    game.status = "in-round";
    game.guessedThisRound = new Set();
    game.roundStartedAt = Date.now();
    game.roundEndsAt = game.roundStartedAt + game.settings.roundDurationSec * 1000;

    const activeGuesserIds = getActiveGuesserIds(lobby, game);
    if (activeGuesserIds.length === 0) {
      endRound(lobby, game, "insufficient-active-players");
      return;
    }

    emitGameState(lobby, game, "round-start");

    game.timerIntervalId = setInterval(() => {
      if (game.status !== "in-round") return;
      emitGameState(lobby, game, "tick");
    }, 1000);

    game.roundTimeoutId = setTimeout(() => {
      endRound(lobby, game, "time");
    }, game.settings.roundDurationSec * 1000);
  }

  function endGame(lobby, game, reason) {
    clearAllTimers(game);
    game.status = "game-over";
    game.word = null;
    game.wordOptions = [];
    game.roundStartedAt = null;
    game.roundEndsAt = null;

    emitGameState(lobby, game, "game-over");
    resetCanvas(lobby, game, "game-over");
    io.to(lobby.id).emit("game:over", {
      reason,
      scores: buildScoreboard(lobby, game.scores)
    });
  }

  function startNextRound(lobby, game) {
    if (!hasEnoughActivePlayers(lobby)) {
      endGame(lobby, game, "insufficient-active-players");
      return;
    }

    game.round += 1;
    beginPresenterSelection(lobby, game, "next-round");
  }

  function endRound(lobby, game, reason, winnerUserId = null) { // Expects userId
    if (game.status !== "in-round" && game.status !== "presenter-choosing") return;

    clearAllTimers(game);
    game.status = "round-ended";
    game.lastRoundResult = {
      reason,
      winnerUserId, // Uses userId
      word: game.word,
      endedAt: new Date().toISOString()
    };

    emitGameState(lobby, game, "round-ended");
    io.to(lobby.id).emit("game:roundEnded", game.lastRoundResult);

    if (game.round >= game.settings.maxRounds) {
      endGame(lobby, game, "max-rounds");
      return;
    }

    game.intermissionTimeoutId = setTimeout(() => {
      if (game.status !== "round-ended") return;
      startNextRound(lobby, game);
    }, game.settings.intermissionSec * 1000);
  }

  function startNewGame(lobby, game) {
    clearAllTimers(game);
    game.status = "idle";
    game.round = 1;
    game.presenterUserId = null; // Uses userId
    game.word = null;
    game.wordOptions = [];
    game.roundStartedAt = null;
    game.roundEndsAt = null;
    game.guessedThisRound = new Set();
    game.lastPresenterIndex = -1;
    game.lastRoundResult = null;
    game.canvasState = null;
    game.canvasVersion = 0;

    game.scores = new Map();
    syncMembers(game, lobby);

    beginPresenterSelection(lobby, game, "game-start");
  }

  function handleCorrectGuess(lobby, game, userId) { // Expects userId
    if (game.guessedThisRound.has(userId)) return;

    const remaining = getRemainingSec(game) || 0;
    const basePoints = 100;
    const timeBonus = remaining;

    const currentScore = game.scores.get(userId) || 0;
    game.scores.set(userId, currentScore + basePoints + timeBonus);
    game.guessedThisRound.add(userId);

    io.to(lobby.id).emit("game:guessCorrect", { userId }); // Broadasts userId

    const activeGuesserIds = getActiveGuesserIds(lobby, game);
    if (activeGuesserIds.length === 0) {
      endRound(lobby, game, "insufficient-active-players", userId);
      return;
    }

    const didAllActiveGuessersGuess = activeGuesserIds.every((activeUserId) =>
      game.guessedThisRound.has(activeUserId)
    );
    if (didAllActiveGuessersGuess) {
      endRound(lobby, game, "all-guessed", userId);
    } else {
      emitGameState(lobby, game, "score");
    }
  }

  socket.on("game:start", (payload = {}, ack) => {
    const auth = requireLobbyAdmin(payload, ack, "Only the lobby admin can start the game");
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.ensureGame(lobby.id, lobby);

    if (game.status !== "idle" && game.status !== "game-over" && !payload.force) {
      emitError(ack, "Game already running (use force to restart)");
      return;
    }

    if (!hasEnoughActivePlayers(lobby)) {
      emitError(ack, "Need at least 2 active players to start a game");
      return;
    }

    startNewGame(lobby, game);

    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("game:chooseWord", (payload = {}, ack) => {
    const auth = requireLobbyMember(payload, ack);
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.getGame(lobby.id);
    if (!game) {
      emitError(ack, "Game not started");
      return;
    }

    if (game.status !== "presenter-choosing") {
      emitError(ack, "Not ready for word selection");
      return;
    }

    if (!requirePresenter(game, ack, "Only the presenter can choose the word")) return;

    const chosen = normalizeWordInput(payload.word);
    if (!chosen) {
      emitError(ack, "Word is required");
      return;
    }

    if (!game.wordOptions.includes(chosen)) {
      emitError(ack, "Word must be selected from provided options");
      return;
    }

    startRound(lobby, game, chosen);

    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("game:guess", (payload = {}, ack) => {
    const auth = requireLobbyMember(payload, ack);
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.getGame(lobby.id);
    if (!game) {
      emitError(ack, "Game not started");
      return;
    }

    if (game.status !== "in-round") {
      emitError(ack, "No active round");
      return;
    }

    if (socket.data.userId === game.presenterUserId) { // Checks userId
      emitError(ack, "Presenter cannot guess");
      return;
    }

    const guess = normalizeWordInput(payload.guess);
    if (!guess) {
      emitError(ack, "Guess is required");
      return;
    }

    if (guess === game.word) {
      handleCorrectGuess(lobby, game, socket.data.userId); // Passes userId
      if (typeof ack === "function") ack({ ok: true, correct: true });
      return;
    }

    if (typeof ack === "function") ack({ ok: true, correct: false });
  });

  socket.on("game:nextRound", (payload = {}, ack) => {
    const auth = requireLobbyAdmin(payload, ack, "Only the lobby admin can advance rounds");
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.getGame(lobby.id);
    if (!game) return emitError(ack, "Game not started");

    if (game.status !== "round-ended") {
      return emitError(ack, "Round has not ended yet");
    }

    startNextRound(lobby, game);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("game:stop", (payload = {}, ack) => {
    const auth = requireLobbyAdmin(payload, ack, "Only the lobby admin can stop the game");
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.getGame(lobby.id);
    if (!game) return emitError(ack, "Game not started");

    endGame(lobby, game, "stopped");
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("game:sync", (payload = {}, ack) => {
    const auth = requireLobbyMember(payload, ack);
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.getGame(lobby.id);
    if (!game) return emitError(ack, "Game not started");

    emitGameStateToSocket(lobby, game, socket, "sync");
    emitCanvasStateToSocket(lobby, game, socket, "sync");
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("game:canvas:sync", (payload = {}, ack) => {
    const auth = requireLobbyMember(payload, ack);
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.getGame(lobby.id);
    if (!game) return emitError(ack, "Game not started");

    emitCanvasStateToSocket(lobby, game, socket, "sync");
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("game:canvas:update", (payload = {}, ack) => {
    const auth = requireLobbyMember(payload, ack);
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.getGame(lobby.id);
    if (!game) return emitError(ack, "Game not started");

    if (game.status !== "in-round") {
      return emitError(ack, "Drawing is only available during an active round");
    }

    if (!requirePresenter(game, ack, "Only the presenter can draw")) return;

    const normalized = normalizeCanvasState(payload.canvas);
    if (normalized.error) {
      return emitError(ack, normalized.error);
    }

    if (!normalized.canvas) {
      return emitError(ack, "Canvas payload is required");
    }

    game.canvasState = normalized.canvas;
    game.canvasVersion += 1;

    emitCanvasState(lobby, game, "update");
    if (typeof ack === "function") ack({ ok: true, version: game.canvasVersion });
  });

  socket.on("game:canvas:clear", (payload = {}, ack) => {
    const auth = requireLobbyMember(payload, ack);
    if (!auth) return;

    const { lobby } = auth;

    const game = gameStore.getGame(lobby.id);
    if (!game) return emitError(ack, "Game not started");

    if (game.status !== "in-round") {
      return emitError(ack, "Drawing is only available during an active round");
    }

    if (!requirePresenter(game, ack, "Only the presenter can clear the canvas")) return;

    resetCanvas(lobby, game, "clear");
    if (typeof ack === "function") ack({ ok: true, version: game.canvasVersion });
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

    const game = gameStore.getGame(lobbyId);
    if (!game) return;

    const activeMemberIds = getActiveMemberIds(lobby);
    if (game.status !== "idle" && game.status !== "game-over" && activeMemberIds.length < 2) {
      endGame(lobby, game, "insufficient-active-players");
      return;
    }

    if (game.status === "presenter-choosing" && userId === game.presenterUserId) {
      beginPresenterSelection(lobby, game, "presenter-disconnected");
      return;
    }

    if (game.status === "in-round") {
      const activeGuesserIds = getActiveGuesserIds(lobby, game);
      if (activeGuesserIds.length === 0) {
        endRound(lobby, game, "insufficient-active-players");
        return;
      }
    }

    emitGameState(lobby, game, "player-left");
  });
}
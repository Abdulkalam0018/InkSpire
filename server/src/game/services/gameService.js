import { createAppError } from "../../shared/errors/appError.js";
import { normalizeLobbyId } from "../../shared/validation/commonValidators.js";
import { getActiveGuesserIds, getActiveMemberIds, hasEnoughActivePlayers } from "../domain/gameRules.js";
import { normalizeCanvasState } from "../domain/gameCanvas.js";
import { normalizeWordInput, pickWordOptions } from "../domain/gameWord.js";
import { getRemainingSec } from "../domain/gameSerializer.js";
import { pickNextPresenter, syncMembers } from "../domain/gameEntity.js";
import { clearAllGameTimers } from "./gameTimerService.js";

export function createGameService({ lobbyStore, gameStore, broadcaster }) {
  function resolveLobbyId(socket, payload) {
    if (typeof payload?.lobbyId === "string" && payload.lobbyId.trim()) {
      return normalizeLobbyId(payload.lobbyId);
    }

    return normalizeLobbyId(socket.data?.lobbyId || "");
  }

  function requireLobbyMember(socket, payload) {
    const lobbyId = resolveLobbyId(socket, payload);
    if (!lobbyId) {
      throw createAppError("LOBBY_CODE_REQUIRED", "Lobby code is required", 400);
    }

    const lobby = lobbyStore.getLobby(lobbyId);
    if (!lobby) {
      throw createAppError("LOBBY_NOT_FOUND", "Lobby not found", 404);
    }

    const userId = socket.data?.userId;
    if (!userId) {
      throw createAppError("UNAUTHORIZED", "Unauthorized: missing user identity", 401);
    }

    if (socket.data?.lobbyId !== lobby.id) {
      throw createAppError("UNAUTHORIZED", "Unauthorized: socket is not joined to this lobby", 401);
    }

    const member = lobby.members.get(userId);
    if (!member) {
      throw createAppError("UNAUTHORIZED", "Unauthorized: you are not a member of this lobby", 401);
    }

    if (member.currentSocketId !== socket.id) {
      throw createAppError("UNAUTHORIZED", "Unauthorized: socket does not match lobby membership", 401);
    }

    return { lobby, member };
  }

  function requireLobbyAdmin(socket, payload, message) {
    const context = requireLobbyMember(socket, payload);
    if (context.lobby.adminUserId !== context.member.userId) {
      throw createAppError("FORBIDDEN", message || "Only the lobby admin can perform this action", 403);
    }

    return context;
  }

  function requirePresenter(socket, game, message) {
    if (socket.data?.userId !== game.presenterUserId) {
      throw createAppError("FORBIDDEN", message || "Only the presenter can perform this action", 403);
    }
  }

  function refreshAndEmitGameState(lobby, game, reason) {
    syncMembers(game, lobby);
    broadcaster.emitGameState(lobby, game, reason);
  }

  function resetCanvas(lobby, game, reason) {
    game.canvasState = null;
    game.canvasVersion += 1;
    broadcaster.emitCanvasState(lobby, game, reason);
  }

  function endGame(lobby, game, reason) {
    clearAllGameTimers(game);
    game.status = "game-over";
    game.word = null;
    game.wordOptions = [];
    game.roundStartedAt = null;
    game.roundEndsAt = null;

    refreshAndEmitGameState(lobby, game, "game-over");
    resetCanvas(lobby, game, "game-over");
    broadcaster.emitGameOver(lobby, game, reason);
  }

  function beginPresenterSelection(lobby, game, reason) {
    clearAllGameTimers(game);

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

    refreshAndEmitGameState(lobby, game, reason);
    resetCanvas(lobby, game, "new-round");
    broadcaster.emitPresenterOptions(lobby, game);
  }

  function startRound(lobby, game, word) {
    clearAllGameTimers(game);
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

    refreshAndEmitGameState(lobby, game, "round-start");

    game.timerIntervalId = setInterval(() => {
      if (game.status !== "in-round") return;
      refreshAndEmitGameState(lobby, game, "tick");
    }, 1000);

    game.roundTimeoutId = setTimeout(() => {
      endRound(lobby, game, "time");
    }, game.settings.roundDurationSec * 1000);
  }

  function startNextRound(lobby, game) {
    if (!hasEnoughActivePlayers(lobby)) {
      endGame(lobby, game, "insufficient-active-players");
      return;
    }

    game.round += 1;
    beginPresenterSelection(lobby, game, "next-round");
  }

  function endRound(lobby, game, reason, winnerUserId = null) {
    if (game.status !== "in-round" && game.status !== "presenter-choosing") return;

    clearAllGameTimers(game);
    game.status = "round-ended";
    game.lastRoundResult = {
      reason,
      winnerUserId,
      word: game.word,
      endedAt: new Date().toISOString()
    };

    refreshAndEmitGameState(lobby, game, "round-ended");
    broadcaster.emitRoundEnded(lobby, game.lastRoundResult);

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
    clearAllGameTimers(game);
    game.status = "idle";
    game.round = 1;
    game.presenterUserId = null;
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

  function handleCorrectGuess(lobby, game, userId) {
    if (game.guessedThisRound.has(userId)) return;

    const remaining = getRemainingSec(game) || 0;
    const basePoints = 100;
    const timeBonus = remaining;

    const currentScore = game.scores.get(userId) || 0;
    game.scores.set(userId, currentScore + basePoints + timeBonus);
    game.guessedThisRound.add(userId);

    broadcaster.emitGuessCorrect(lobby, userId);

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
      refreshAndEmitGameState(lobby, game, "score");
    }
  }

  function start(socket, payload = {}) {
    const { lobby } = requireLobbyAdmin(socket, payload, "Only the lobby admin can start the game");
    const game = gameStore.ensureGame(lobby.id, lobby);

    if (game.status !== "idle" && game.status !== "game-over" && !payload.force) {
      throw createAppError("GAME_ALREADY_RUNNING", "Game already running (use force to restart)", 400);
    }

    if (!hasEnoughActivePlayers(lobby)) {
      throw createAppError("INSUFFICIENT_ACTIVE_PLAYERS", "Need at least 2 active players to start a game", 400);
    }

    startNewGame(lobby, game);
  }

  function chooseWord(socket, payload = {}) {
    const { lobby } = requireLobbyMember(socket, payload);
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    if (game.status !== "presenter-choosing") {
      throw createAppError("INVALID_GAME_STATE", "Not ready for word selection", 400);
    }

    requirePresenter(socket, game, "Only the presenter can choose the word");

    const chosen = normalizeWordInput(payload.word);
    if (!chosen) {
      throw createAppError("WORD_REQUIRED", "Word is required", 400);
    }

    if (!game.wordOptions.includes(chosen)) {
      throw createAppError("INVALID_WORD_CHOICE", "Word must be selected from provided options", 400);
    }

    startRound(lobby, game, chosen);
  }

  function guess(socket, payload = {}) {
    const { lobby } = requireLobbyMember(socket, payload);
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    if (game.status !== "in-round") {
      throw createAppError("INVALID_GAME_STATE", "No active round", 400);
    }

    if (socket.data.userId === game.presenterUserId) {
      throw createAppError("PRESENTER_CANNOT_GUESS", "Presenter cannot guess", 400);
    }

    const normalizedGuess = normalizeWordInput(payload.guess);
    if (!normalizedGuess) {
      throw createAppError("GUESS_REQUIRED", "Guess is required", 400);
    }

    if (normalizedGuess === game.word) {
      handleCorrectGuess(lobby, game, socket.data.userId);
      return { correct: true };
    }

    return { correct: false };
  }

  function nextRound(socket, payload = {}) {
    const { lobby } = requireLobbyAdmin(socket, payload, "Only the lobby admin can advance rounds");
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    if (game.status !== "round-ended") {
      throw createAppError("INVALID_GAME_STATE", "Round has not ended yet", 400);
    }

    startNextRound(lobby, game);
  }

  function stop(socket, payload = {}) {
    const { lobby } = requireLobbyAdmin(socket, payload, "Only the lobby admin can stop the game");
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    endGame(lobby, game, "stopped");
  }

  function sync(socket, payload = {}) {
    const { lobby } = requireLobbyMember(socket, payload);
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    syncMembers(game, lobby);
    broadcaster.emitGameStateToSocket(lobby, game, socket, "sync");
    broadcaster.emitCanvasStateToSocket(lobby, game, socket, "sync");
  }

  function syncCanvas(socket, payload = {}) {
    const { lobby } = requireLobbyMember(socket, payload);
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    broadcaster.emitCanvasStateToSocket(lobby, game, socket, "sync");
  }

  function updateCanvas(socket, payload = {}) {
    const { lobby } = requireLobbyMember(socket, payload);
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    if (game.status !== "in-round") {
      throw createAppError("INVALID_GAME_STATE", "Drawing is only available during an active round", 400);
    }

    requirePresenter(socket, game, "Only the presenter can draw");

    const normalized = normalizeCanvasState(payload.canvas);
    if (normalized.error) {
      throw createAppError("INVALID_CANVAS_PAYLOAD", normalized.error, 400);
    }

    if (!normalized.canvas) {
      throw createAppError("CANVAS_REQUIRED", "Canvas payload is required", 400);
    }

    game.canvasState = normalized.canvas;
    game.canvasVersion += 1;

    broadcaster.emitCanvasState(lobby, game, "update");
    return { version: game.canvasVersion };
  }

  function clearCanvas(socket, payload = {}) {
    const { lobby } = requireLobbyMember(socket, payload);
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    if (game.status !== "in-round") {
      throw createAppError("INVALID_GAME_STATE", "Drawing is only available during an active round", 400);
    }

    requirePresenter(socket, game, "Only the presenter can clear the canvas");

    resetCanvas(lobby, game, "clear");
    return { version: game.canvasVersion };
  }

  function handleDisconnect(socket) {
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

    refreshAndEmitGameState(lobby, game, "player-left");
  }

  return {
    start,
    chooseWord,
    guess,
    nextRound,
    stop,
    sync,
    syncCanvas,
    updateCanvas,
    clearCanvas,
    handleDisconnect
  };
}

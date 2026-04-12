import { createAppError } from "../../shared/errors/appError.js";
import { normalizeNonEmptyString } from "../../shared/validation/commonValidators.js";
import {
  requireLobbyAdmin as requireSharedLobbyAdmin,
  requireLobbyMember as requireSharedLobbyMember
} from "../../shared/socket/lobbySocketUtils.js";
import { getActiveGuesserIds, getActiveMemberIds, hasEnoughActivePlayers } from "../domain/gameRules.js";
import { normalizeCanvasState } from "../domain/gameCanvas.js";
import { buildHintMask, normalizeWordInput, pickHintRevealOrder, pickWordOptions } from "../domain/gameWord.js";
import { getRemainingSec } from "../domain/gameSerializer.js";
import { pickNextPresenter, syncMembers } from "../domain/gameEntity.js";
import { clearAllGameTimers } from "./gameTimerService.js";

const MAX_CHAT_MESSAGE_LENGTH = 180;
const MAX_CHAT_FEED_ENTRIES = 80;
const PRESENTER_CHOICE_TIMEOUT_SEC = 15;
const CHAT_ENABLED_STATUSES = new Set(["presenter-choosing", "round-ended", "game-over"]);
const HINT_REVEAL_RATIOS = [0.4, 0.7];

export function createGameService({ lobbyStore, gameStore, broadcaster }) {
  function requireLobbyMember(socket, payload) {
    return requireSharedLobbyMember({ lobbyStore, socket, payload });
  }

  function requireLobbyAdmin(socket, payload, message) {
    const context = requireLobbyMember(socket, payload);
    requireSharedLobbyAdmin({
      socket,
      lobby: context.lobby,
      member: context.member,
      message
    });

    return context;
  }

  function requirePresenter(socket, game, message) {
    if (socket.data?.userId !== game.presenterUserId) {
      throw createAppError("FORBIDDEN", message || "Only the presenter can perform this action", 403);
    }
  }

  function toValidChatMessage(value) {
    const normalized = normalizeNonEmptyString(value, "");
    if (!normalized) return "";
    return normalized.slice(0, MAX_CHAT_MESSAGE_LENGTH);
  }

  function appendFeedEntry(game, entry) {
    const feed = Array.isArray(game.chatFeed) ? game.chatFeed : [];
    game.chatFeed = [...feed, entry].slice(-MAX_CHAT_FEED_ENTRIES);
  }

  function publishFeedMessage(lobby, game, entry) {
    const payload = {
      kind: entry.kind || "chat",
      userId: entry.userId || null,
      name: entry.name || "Player",
      message: entry.message,
      sentAt: entry.sentAt || new Date().toISOString()
    };

    appendFeedEntry(game, payload);

    if (payload.kind === "system") {
      broadcaster.emitChatSystemMessage(lobby, payload);
      return;
    }

    broadcaster.emitChatMessage(lobby, payload);
  }

  function publishSystemMessage(lobby, game, message) {
    if (!message) return;

    publishFeedMessage(lobby, game, {
      kind: "system",
      message
    });
  }

  function initializeHintState(game) {
    if (!game.word) {
      game.hintState = null;
      game.hintRevealOrder = [];
      return;
    }

    game.hintRevealOrder = pickHintRevealOrder(game.word);
    const totalHints = Math.min(HINT_REVEAL_RATIOS.length, Math.max(0, game.hintRevealOrder.length - 1));

    game.hintState = {
      mask: buildHintMask(game.word, []),
      revealedCount: 0,
      totalHints
    };
  }

  function scheduleHintTimers(lobby, game) {
    if (!game.word || !game.hintState || game.hintState.totalHints <= 0) {
      return;
    }

    game.hintTimeoutIds = [];

    for (let hintIndex = 0; hintIndex < game.hintState.totalHints; hintIndex += 1) {
      const ratio = HINT_REVEAL_RATIOS[hintIndex] ?? 0.8;
      const delayMs = Math.max(1000, Math.floor(game.settings.roundDurationSec * 1000 * ratio));

      const timeoutId = setTimeout(() => {
        if (game.status !== "in-round" || !game.word || !game.hintState) {
          return;
        }

        const revealedCount = hintIndex + 1;
        const revealIndices = game.hintRevealOrder.slice(0, revealedCount);
        game.hintState = {
          ...game.hintState,
          mask: buildHintMask(game.word, revealIndices),
          revealedCount
        };

        refreshAndEmitGameState(lobby, game, "hint");
        broadcaster.emitHintUpdate(lobby, game, "timer");
      }, delayMs);

      game.hintTimeoutIds.push(timeoutId);
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
    game.hintState = null;
    game.hintRevealOrder = [];
    game.roundStartedAt = null;
    game.roundEndsAt = null;
    game.presenterChoiceEndsAt = null;
    game.latestPresenterTimeout = null;

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
    game.hintState = null;
    game.hintRevealOrder = [];
    game.guessedThisRound = new Set();
    game.roundStartedAt = null;
    game.roundEndsAt = null;
    game.presenterChoiceEndsAt = Date.now() + PRESENTER_CHOICE_TIMEOUT_SEC * 1000;
    game.latestWordReveal = null;
    game.latestPresenterTimeout = null;
    game.presenterUserId = pickNextPresenter(lobby, game, activeMemberIds);
    if (!game.presenterUserId) {
      endGame(lobby, game, "insufficient-active-players");
      return;
    }

    game.lastRoundResult = null;

    refreshAndEmitGameState(lobby, game, reason);
    resetCanvas(lobby, game, "new-round");
    broadcaster.emitPresenterOptions(lobby, game);

    game.presenterChoiceTimeoutId = setTimeout(() => {
      if (game.status !== "presenter-choosing") return;

      const randomIndex = Math.floor(Math.random() * game.wordOptions.length);
      const autoSelectedWord = game.wordOptions[randomIndex];
      if (!autoSelectedWord) {
        endRound(lobby, game, "presenter-timeout");
        return;
      }

      game.latestPresenterTimeout = {
        lobbyId: lobby.id,
        round: game.round,
        presenterUserId: game.presenterUserId,
        timeoutSec: PRESENTER_CHOICE_TIMEOUT_SEC
      };

      broadcaster.emitPresenterTimeout(lobby, game, PRESENTER_CHOICE_TIMEOUT_SEC);
      publishSystemMessage(lobby, game, "Presenter timed out. A word was auto-selected.");
      startRound(lobby, game, autoSelectedWord);
    }, PRESENTER_CHOICE_TIMEOUT_SEC * 1000);
  }

  function startRound(lobby, game, word) {
    clearAllGameTimers(game);
    game.word = word;
    game.status = "in-round";
    game.guessedThisRound = new Set();
    game.roundStartedAt = Date.now();
    game.roundEndsAt = game.roundStartedAt + game.settings.roundDurationSec * 1000;
    game.presenterChoiceEndsAt = null;

    initializeHintState(game);

    const activeGuesserIds = getActiveGuesserIds(lobby, game);
    if (activeGuesserIds.length === 0) {
      endRound(lobby, game, "insufficient-active-players");
      return;
    }

    refreshAndEmitGameState(lobby, game, "round-start");
    broadcaster.emitHintUpdate(lobby, game, "round-start");
    scheduleHintTimers(lobby, game);

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
    game.presenterChoiceEndsAt = null;
    game.latestWordReveal = game.word
      ? {
          lobbyId: lobby.id,
          round: game.round,
          word: game.word,
          reason
        }
      : null;

    refreshAndEmitGameState(lobby, game, "round-ended");
    broadcaster.emitRoundEnded(lobby, game.lastRoundResult);
    broadcaster.emitWordRevealed(lobby, game, reason);
    if (game.word) {
      publishSystemMessage(lobby, game, `Round ended. The word was \"${game.word}\".`);
    }

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
    game.hintState = null;
    game.hintRevealOrder = [];
    game.lastPresenterIndex = -1;
    game.lastRoundResult = null;
    game.canvasState = null;
    game.canvasVersion = 0;
    game.presenterChoiceEndsAt = null;
    game.chatFeed = [];
    game.latestWordReveal = null;
    game.latestPresenterTimeout = null;
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
    const guesser = lobby.members.get(userId);
    if (guesser) {
      publishSystemMessage(lobby, game, `${guesser.name} guessed the word.`);
    }

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

  // The following functions are for handling socket events

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
    const { lobby, member } = requireLobbyMember(socket, payload);
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

    const guessFeedText = toValidChatMessage(payload.guess) || normalizedGuess;
    publishFeedMessage(lobby, game, {
      kind: "guess",
      userId: member.userId,
      name: member.name,
      message: guessFeedText
    });

    return { correct: false };
  }

  function sendChat(socket, payload = {}) {
    const { lobby, member } = requireLobbyMember(socket, payload);
    const game = gameStore.getGame(lobby.id);

    if (!game) {
      throw createAppError("GAME_NOT_STARTED", "Game not started", 400);
    }

    if (game.status === "in-round") {
      throw createAppError(
        "CHAT_DISABLED_DURING_ROUND",
        "Public chat is disabled during active rounds. Submit guesses using the guess input.",
        400
      );
    }

    if (!CHAT_ENABLED_STATUSES.has(game.status)) {
      throw createAppError("CHAT_NOT_AVAILABLE", "Chat is not available in the current game state", 400);
    }

    const message = toValidChatMessage(payload.message);
    if (!message) {
      throw createAppError("MESSAGE_REQUIRED", "Message is required", 400);
    }

    publishFeedMessage(lobby, game, {
      kind: "chat",
      userId: member.userId,
      name: member.name,
      message
    });

    return { sent: true };
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
    broadcaster.emitChatBackfillToSocket(lobby, game, socket);
    broadcaster.emitTransientNoticesToSocket(game, socket);
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
    sendChat,
    nextRound,
    stop,
    sync,
    syncCanvas,
    updateCanvas,
    clearCanvas,
    handleDisconnect
  };
}

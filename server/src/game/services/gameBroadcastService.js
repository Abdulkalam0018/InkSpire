import {
  buildBaseGameState,
  buildScoreboard,
  personalizeGameState
} from "../domain/gameSerializer.js";

export function createGameBroadcastService({ io, events }) {
  function emitGameState(lobby, game, reason) {
    const baseState = buildBaseGameState(game, lobby, reason);

    for (const member of lobby.members.values()) {
      if (!member.isOnline) continue;
      const stateForMember = personalizeGameState(baseState, game, member.userId);
      io.to(member.currentSocketId).emit(events.STATE, stateForMember);
    }
  }

  function emitGameStateToSocket(lobby, game, socket, reason) {
    const baseState = buildBaseGameState(game, lobby, reason);
    const stateForMember = personalizeGameState(baseState, game, socket.data.userId);
    io.to(socket.id).emit(events.STATE, stateForMember);
  }

  function emitCanvasState(lobby, game, reason) {
    io.to(lobby.id).emit(events.CANVAS_STATE, {
      lobbyId: lobby.id,
      canvas: game.canvasState,
      version: game.canvasVersion,
      reason
    });
  }

  function emitCanvasStateToSocket(lobby, game, socket, reason) {
    io.to(socket.id).emit(events.CANVAS_STATE, {
      lobbyId: lobby.id,
      canvas: game.canvasState,
      version: game.canvasVersion,
      reason
    });
  }

  function emitPresenterOptions(lobby, game) {
    if (!game.presenterUserId) return;

    const presenter = lobby.members.get(game.presenterUserId);
    if (!presenter || !presenter.isOnline) return;

    const payload = {
      lobbyId: lobby.id,
      round: game.round,
      options: game.wordOptions
    };

    io.to(presenter.currentSocketId).emit(events.PRESENTER_OPTIONS, payload);
  }

  function emitRoundEnded(lobby, lastRoundResult) {
    io.to(lobby.id).emit(events.ROUND_ENDED, lastRoundResult);
  }

  function emitGuessCorrect(lobby, userId) {
    io.to(lobby.id).emit(events.GUESS_CORRECT, { userId });
  }

  function emitChatMessage(lobby, entry) {
    if (!entry?.message) return;

    io.to(lobby.id).emit(events.CHAT_MESSAGE, {
      lobbyId: lobby.id,
      userId: entry.userId || null,
      name: entry.name || "Player",
      message: entry.message,
      kind: entry.kind || "chat",
      sentAt: entry.sentAt || new Date().toISOString()
    });
  }

  function emitChatSystemMessage(lobby, entry) {
    const message = typeof entry === "string" ? entry : entry?.message;
    if (!message) return;

    io.to(lobby.id).emit(events.CHAT_SYSTEM, {
      lobbyId: lobby.id,
      message,
      kind: "system",
      sentAt:
        typeof entry === "object" && entry?.sentAt ? entry.sentAt : new Date().toISOString()
    });
  }

  function emitChatBackfillToSocket(lobby, game, socket) {
    io.to(socket.id).emit(events.CHAT_BACKFILL, {
      lobbyId: lobby.id,
      messages: Array.isArray(game.chatFeed) ? game.chatFeed : []
    });
  }

  function emitHintUpdate(lobby, game, reason = "timer") {
    if (!game.hintState) return;

    io.to(lobby.id).emit(events.HINT_UPDATE, {
      lobbyId: lobby.id,
      round: game.round,
      hint: {
        mask: game.hintState.mask,
        revealedCount: game.hintState.revealedCount,
        totalHints: game.hintState.totalHints
      },
      reason
    });
  }

  function emitWordRevealed(lobby, game, reason) {
    if (!game.word) return;

    io.to(lobby.id).emit(events.WORD_REVEALED, {
      lobbyId: lobby.id,
      round: game.round,
      word: game.word,
      reason
    });
  }

  function emitPresenterTimeout(lobby, game, timeoutSec) {
    io.to(lobby.id).emit(events.PRESENTER_TIMEOUT, {
      lobbyId: lobby.id,
      round: game.round,
      presenterUserId: game.presenterUserId,
      timeoutSec
    });
  }

  function emitTransientNoticesToSocket(game, socket) {
    if (game.latestWordReveal) {
      io.to(socket.id).emit(events.WORD_REVEALED, game.latestWordReveal);
    }

    if (game.latestPresenterTimeout) {
      io.to(socket.id).emit(events.PRESENTER_TIMEOUT, game.latestPresenterTimeout);
    }
  }

  function emitGameOver(lobby, game, reason) {
    io.to(lobby.id).emit(events.OVER, {
      reason,
      scores: buildScoreboard(lobby, game.scores)
    });
  }

  return {
    emitGameState,
    emitGameStateToSocket,
    emitCanvasState,
    emitCanvasStateToSocket,
    emitPresenterOptions,
    emitRoundEnded,
    emitGuessCorrect,
    emitChatMessage,
    emitChatSystemMessage,
    emitChatBackfillToSocket,
    emitHintUpdate,
    emitWordRevealed,
    emitPresenterTimeout,
    emitTransientNoticesToSocket,
    emitGameOver
  };
}

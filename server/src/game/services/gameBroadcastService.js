import { buildBaseGameState, personalizeGameState } from "../domain/gameSerializer.js";
import { buildScoreboard } from "../domain/gameScoreboard.js";

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
    io.to(presenter.currentSocketId).emit("game:presenter", payload);
  }

  function emitRoundEnded(lobby, lastRoundResult) {
    io.to(lobby.id).emit(events.ROUND_ENDED, lastRoundResult);
  }

  function emitGuessCorrect(lobby, userId) {
    io.to(lobby.id).emit(events.GUESS_CORRECT, { userId });
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
    emitGameOver
  };
}

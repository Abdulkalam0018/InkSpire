import { GAME_EVENTS } from "../../shared/events/index.js";
import { respondWithSocketError } from "../../shared/errors/socketErrorMapper.js";
import { ackSuccess } from "../../shared/socket/ack.js";

export function attachGameSocketHandlers(socket, gameService) {
  socket.on(GAME_EVENTS.START, (payload = {}, ack) => {
    try {
      gameService.start(socket, payload);
      ackSuccess(ack);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to start game" });
    }
  });

  socket.on(GAME_EVENTS.CHOOSE_WORD, (payload = {}, ack) => {
    try {
      gameService.chooseWord(socket, payload);
      ackSuccess(ack);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to choose word" });
    }
  });

  socket.on(GAME_EVENTS.GUESS, (payload = {}, ack) => {
    try {
      const result = gameService.guess(socket, payload);
      ackSuccess(ack, result);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to submit guess" });
    }
  });

  socket.on(GAME_EVENTS.NEXT_ROUND, (payload = {}, ack) => {
    try {
      gameService.nextRound(socket, payload);
      ackSuccess(ack);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to advance round" });
    }
  });

  socket.on(GAME_EVENTS.STOP, (payload = {}, ack) => {
    try {
      gameService.stop(socket, payload);
      ackSuccess(ack);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to stop game" });
    }
  });

  socket.on(GAME_EVENTS.SYNC, (payload = {}, ack) => {
    try {
      gameService.sync(socket, payload);
      ackSuccess(ack);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to sync game" });
    }
  });

  socket.on(GAME_EVENTS.CANVAS_SYNC, (payload = {}, ack) => {
    try {
      gameService.syncCanvas(socket, payload);
      ackSuccess(ack);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to sync canvas" });
    }
  });

  socket.on(GAME_EVENTS.CANVAS_UPDATE, (payload = {}, ack) => {
    try {
      const result = gameService.updateCanvas(socket, payload);
      ackSuccess(ack, result);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to update canvas" });
    }
  });

  socket.on(GAME_EVENTS.CANVAS_CLEAR, (payload = {}, ack) => {
    try {
      const result = gameService.clearCanvas(socket, payload);
      ackSuccess(ack, result);
    } catch (error) {
      respondWithSocketError({ socket, ack, eventName: GAME_EVENTS.ERROR, error, fallbackMessage: "Failed to clear canvas" });
    }
  });

  socket.on("disconnect", () => {
    gameService.handleDisconnect(socket);
  });
}

import { LOBBY_EVENTS } from "../../shared/events/index.js";
import { respondWithSocketError } from "../../shared/errors/socketErrorMapper.js";
import { ackSuccess } from "../../shared/socket/ack.js";
import { buildLobbyMember } from "../domain/lobbyMember.js";

export function attachLobbySocketHandlers(socket, lobbyService) {
  socket.on(LOBBY_EVENTS.CREATE, (payload = {}, ack) => {
    try {
      const owner = buildLobbyMember(socket, payload.displayName);
      const lobby = lobbyService.createLobby(socket, owner, payload.settings);
      ackSuccess(ack, { lobbyId: lobby.id });
    } catch (error) {
      respondWithSocketError({
        socket,
        ack,
        eventName: LOBBY_EVENTS.ERROR,
        error,
        fallbackMessage: "Failed to create lobby"
      });
    }
  });

  socket.on(LOBBY_EVENTS.JOIN, (payload = {}, ack) => {
    try {
      const member = buildLobbyMember(socket, payload.displayName);
      const lobby = lobbyService.joinLobby(socket, member, payload.lobbyId);
      ackSuccess(ack, { lobbyId: lobby.id });
    } catch (error) {
      respondWithSocketError({
        socket,
        ack,
        eventName: LOBBY_EVENTS.ERROR,
        error,
        fallbackMessage: "Failed to join lobby"
      });
    }
  });

  socket.on(LOBBY_EVENTS.LEAVE, (_payload = {}, ack) => {
    try {
      lobbyService.leaveLobby(socket);
      socket.emit(LOBBY_EVENTS.LEFT, { ok: true });
      ackSuccess(ack);
    } catch (error) {
      respondWithSocketError({
        socket,
        ack,
        eventName: LOBBY_EVENTS.ERROR,
        error,
        fallbackMessage: "Failed to leave lobby"
      });
    }
  });

  socket.on(LOBBY_EVENTS.UPDATE_SETTINGS, (payload = {}, ack) => {
    try {
      lobbyService.updateLobbySettings(socket, payload);
      ackSuccess(ack);
    } catch (error) {
      respondWithSocketError({
        socket,
        ack,
        eventName: LOBBY_EVENTS.ERROR,
        error,
        fallbackMessage: "Failed to update lobby settings"
      });
    }
  });

  socket.on("disconnect", () => {
    lobbyService.handleDisconnect(socket);
  });
}

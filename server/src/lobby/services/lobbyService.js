import { createAppError } from "../../shared/errors/appError.js";
import { normalizeLobbyId } from "../../shared/validation/commonValidators.js";
import {
  requireLobby,
  requireLobbyAdmin,
  resolveLobbyIdFromPayloadOrSocket
} from "../../shared/socket/lobbySocketUtils.js";

export function createLobbyService({ io, lobbyStore, gameStore, disconnectService, events }) {
  function emitLobbyState(lobby) {
    io.to(lobby.id).emit(events.STATE, lobbyStore.serializeLobby(lobby));
  }

  function leaveLobbyById(socket, lobbyId, userId) {
    if (!lobbyId || !userId) return;

    disconnectService.clear(lobbyId, userId);

    const result = lobbyStore.removeMember(lobbyId, userId);
    socket.leave(lobbyId);

    if (socket.data?.lobbyId === lobbyId) {
      socket.data.lobbyId = null;
    }

    if (result?.lobby) {
      emitLobbyState(result.lobby);
    }

    if (result?.deleted && gameStore) {
      gameStore.removeGame(lobbyId);
    }
  }

  function createLobby(socket, owner, settings) {
    const previousLobbyId = socket.data?.lobbyId;
    const previousUserId = socket.data?.userId;

    const lobby = lobbyStore.createLobby(settings, owner);

    socket.join(lobby.id);
    socket.data.userId = owner.userId;
    socket.data.lobbyId = lobby.id;

    if (previousLobbyId && previousLobbyId !== lobby.id) {
      leaveLobbyById(socket, previousLobbyId, previousUserId);
    }

    emitLobbyState(lobby);
    return lobby;
  }

  function joinLobby(socket, member, lobbyId) {
    const normalizedLobbyId = normalizeLobbyId(lobbyId);
    if (!normalizedLobbyId) {
      throw createAppError("LOBBY_CODE_REQUIRED", "Lobby code is required", 400);
    }

    const joinResult = lobbyStore.addMember(normalizedLobbyId, member);
    if (joinResult?.error) {
      throw createAppError("LOBBY_JOIN_FAILED", joinResult.error, 400);
    }

    disconnectService.clear(normalizedLobbyId, member.userId);

    const previousLobbyId = socket.data?.lobbyId;

    socket.join(normalizedLobbyId);
    socket.data.userId = member.userId;
    socket.data.lobbyId = normalizedLobbyId;

    if (previousLobbyId && previousLobbyId !== normalizedLobbyId) {
      leaveLobbyById(socket, previousLobbyId, member.userId);
    }

    emitLobbyState(joinResult.lobby);
    return joinResult.lobby;
  }

  function leaveLobby(socket) {
    const lobbyId = socket.data?.lobbyId;
    const userId = socket.data?.userId;

    if (!lobbyId) {
      throw createAppError("LOBBY_NOT_JOINED", "You are not in a lobby", 400);
    }

    leaveLobbyById(socket, lobbyId, userId);
    return { ok: true };
  }

  function updateLobbySettings(socket, payload = {}) {
    const lobbyId = resolveLobbyIdFromPayloadOrSocket(socket, payload);
    const lobby = requireLobby({ lobbyStore, lobbyId });

    const result = lobbyStore.updateSettings(lobby.id, socket.data?.userId, payload.settings);
    if (result?.error) {
      throw createAppError("LOBBY_SETTINGS_UPDATE_FAILED", result.error, 400);
    }

    emitLobbyState(result.lobby);

    if (gameStore) {
      const existingGame = gameStore.getGame(result.lobby.id);
      if (existingGame) {
        gameStore.ensureGame(result.lobby.id, result.lobby);
      }
    }

    return result.lobby;
  }

  function kickMember(socket, payload = {}) {
    const lobbyId = resolveLobbyIdFromPayloadOrSocket(socket, payload);
    const lobby = requireLobby({ lobbyStore, lobbyId });
    requireLobbyAdmin({
      socket,
      lobby,
      message: "Only the lobby admin can kick members"
    });

    const targetUserId = payload?.userId;
    if (!targetUserId) {
      throw createAppError("USER_ID_REQUIRED", "User id is required to kick a member", 400);
    }

    if (targetUserId === lobby.adminUserId) {
      throw createAppError("INVALID_KICK_TARGET", "Lobby admin cannot be kicked", 400);
    }

    const targetMember = lobby.members.get(targetUserId);
    if (!targetMember) {
      throw createAppError("LOBBY_MEMBER_NOT_FOUND", "Lobby member not found", 404);
    }

    const kickReason =
      typeof payload?.reason === "string" && payload.reason.trim()
        ? payload.reason.trim().slice(0, 120)
        : "Removed by the lobby admin";

    disconnectService.clear(lobby.id, targetUserId);

    const targetSocket = io.sockets.sockets.get(targetMember.currentSocketId);
    if (targetSocket) {
      targetSocket.leave(lobby.id);
      if (targetSocket.data?.lobbyId === lobby.id) {
        targetSocket.data.lobbyId = null;
      }
      targetSocket.emit(events.KICKED, {
        lobbyId: lobby.id,
        reason: kickReason
      });
    }

    const result = lobbyStore.removeMember(lobby.id, targetUserId);

    if (result?.lobby) {
      emitLobbyState(result.lobby);
      return result.lobby;
    }

    if (result?.deleted && gameStore) {
      gameStore.removeGame(lobby.id);
    }

    return null;
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
    emitLobbyState(lobby);

    disconnectService.schedule(lobbyId, userId, () => {
      const freshLobby = lobbyStore.getLobby(lobbyId);
      if (!freshLobby) return;

      const freshMember = freshLobby.members.get(userId);
      if (!freshMember || freshMember.isOnline) return;

      const result = lobbyStore.removeMember(lobbyId, userId);
      if (result?.lobby) {
        emitLobbyState(result.lobby);
      }

      if (result?.deleted && gameStore) {
        gameStore.removeGame(lobbyId);
      }
    });
  }

  return {
    emitLobbyState,
    createLobby,
    joinLobby,
    leaveLobby,
    updateLobbySettings,
    kickMember,
    handleDisconnect
  };
}

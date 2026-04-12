import { createAppError } from "../errors/appError.js";
import { normalizeLobbyId } from "../validation/commonValidators.js";

export function getSocketUserId(socket) {
  const userId =
    socket?.data?.userId ||
    socket?.auth?.userId ||
    socket?.user?.clerkId ||
    socket?.user?.id ||
    socket?.handshake?.auth?.userId;

  return typeof userId === "string" && userId.trim() ? userId.trim() : "";
}

export function getSocketLobbyId(socket) {
  return normalizeLobbyId(socket?.data?.lobbyId || "");
}

export function setSocketContext(socket, { userId, lobbyId } = {}) {
  if (!socket.data) socket.data = {};
  if (userId !== undefined) {
    socket.data.userId = userId;
  }
  if (lobbyId !== undefined) {
    socket.data.lobbyId = lobbyId;
  }
}

export function resolveLobbyIdFromPayloadOrSocket(socket, payload) {
  if (typeof payload?.lobbyId === "string" && payload.lobbyId.trim()) {
    return normalizeLobbyId(payload.lobbyId);
  }

  return getSocketLobbyId(socket);
}

export function requireLobby({ lobbyStore, lobbyId }) {
  const normalizedLobbyId = normalizeLobbyId(lobbyId);
  if (!normalizedLobbyId) {
    throw createAppError("LOBBY_CODE_REQUIRED", "Lobby code is required", 400);
  }

  const lobby = lobbyStore.getLobby(normalizedLobbyId);
  if (!lobby) {
    throw createAppError("LOBBY_NOT_FOUND", "Lobby not found", 404);
  }

  return lobby;
}

export function requireLobbyMember({ lobbyStore, socket, payload = {}, lobbyId }) {
  const resolvedLobbyId = normalizeLobbyId(
    lobbyId || resolveLobbyIdFromPayloadOrSocket(socket, payload)
  );

  const lobby = requireLobby({ lobbyStore, lobbyId: resolvedLobbyId });

  const userId = getSocketUserId(socket);
  if (!userId) {
    throw createAppError("UNAUTHORIZED", "Unauthorized: missing user identity", 401);
  }

  if (getSocketLobbyId(socket) !== lobby.id) {
    throw createAppError("UNAUTHORIZED", "Unauthorized: socket is not joined to this lobby", 401);
  }

  const member = lobby.members.get(userId);
  if (!member) {
    throw createAppError("UNAUTHORIZED", "Unauthorized: you are not a member of this lobby", 401);
  }

  if (member.currentSocketId !== socket.id) {
    throw createAppError("UNAUTHORIZED", "Unauthorized: socket does not match lobby membership", 401);
  }

  return { lobby, member, userId };
}

export function requireLobbyAdmin({ socket, lobby, member, message }) {
  const actorUserId = member?.userId || getSocketUserId(socket);

  if (lobby.adminUserId !== actorUserId) {
    throw createAppError(
      "FORBIDDEN",
      message || "Only the lobby admin can perform this action",
      403
    );
  }
}
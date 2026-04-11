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

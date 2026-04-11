import { getSocketUserId } from "../../shared/socket/socketContext.js";
import { normalizeNonEmptyString } from "../../shared/validation/commonValidators.js";

export function buildLobbyMember(socket, displayName) {
  const derivedUserId = getSocketUserId(socket);
  const userId = derivedUserId || `guest_${socket.id}`;

  const fallbackName = `Guest-${userId.slice(0, 6)}`;
  const name = normalizeNonEmptyString(displayName, socket?.user?.name || fallbackName);

  return {
    userId,
    currentSocketId: socket.id,
    name,
    isOnline: true
  };
}

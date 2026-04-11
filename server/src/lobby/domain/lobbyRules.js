export function isLobbyAdmin(lobby, userId) {
  return Boolean(lobby && userId && lobby.adminUserId === userId);
}

export function isLobbyMember(lobby, userId) {
  return Boolean(lobby?.members?.has(userId));
}

export function isLobbyFull(lobby) {
  if (!lobby) return false;
  return lobby.members.size >= lobby.settings.maxPlayers;
}

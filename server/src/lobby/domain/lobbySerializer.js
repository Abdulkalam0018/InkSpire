export function serializeLobbyMember(member) {
  return {
    userId: member.userId,
    name: member.name,
    isOnline: member.isOnline
  };
}

export function serializeLobby(lobby) {
  return {
    id: lobby.id,
    settings: lobby.settings,
    adminUserId: lobby.adminUserId,
    createdAt: lobby.createdAt,
    members: Array.from(lobby.members.values()).map(serializeLobbyMember)
  };
}

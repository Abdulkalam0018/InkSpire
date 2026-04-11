export function getActiveMemberIds(lobby) {
  const active = [];

  for (const member of lobby.members.values()) {
    if (member.isOnline) {
      active.push(member.userId);
    }
  }

  return active;
}

export function getActiveGuesserIds(lobby, game) {
  return getActiveMemberIds(lobby).filter((userId) => userId !== game.presenterUserId);
}

export function hasEnoughActivePlayers(lobby, minimum = 2) {
  return getActiveMemberIds(lobby).length >= minimum;
}

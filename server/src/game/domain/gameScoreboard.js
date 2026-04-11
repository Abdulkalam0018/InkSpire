export function buildScoreboard(lobby, scores) {
  const list = [];

  for (const member of lobby.members.values()) {
    list.push({
      userId: member.userId,
      name: member.name,
      score: scores.get(member.userId) || 0,
      isOnline: member.isOnline
    });
  }

  list.sort((a, b) => b.score - a.score);
  return list;
}

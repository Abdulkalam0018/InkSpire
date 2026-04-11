import { normalizeGameSettings } from "./gameSettings.js";

export function createGame(lobbyId, lobby) {
  return {
    lobbyId,
    status: "idle",
    round: 0,
    presenterUserId: null,
    word: null,
    wordOptions: [],
    roundStartedAt: null,
    roundEndsAt: null,
    scores: new Map(),
    guessedThisRound: new Set(),
    lastPresenterIndex: -1,
    lastRoundResult: null,
    settings: normalizeGameSettings(lobby?.settings || {}),
    canvasState: null,
    canvasVersion: 0,
    timerIntervalId: null,
    roundTimeoutId: null,
    intermissionTimeoutId: null
  };
}

export function syncMembers(game, lobby) {
  for (const member of lobby.members.values()) {
    if (!game.scores.has(member.userId)) {
      game.scores.set(member.userId, 0);
    }
  }

  for (const userId of game.scores.keys()) {
    if (!lobby.members.has(userId)) {
      game.scores.delete(userId);
      game.guessedThisRound.delete(userId);
    }
  }
}

export function pickNextPresenter(lobby, game, eligibleMemberIds = null) {
  const memberIds = Array.isArray(eligibleMemberIds)
    ? eligibleMemberIds.filter((userId) => lobby.members.has(userId))
    : Array.from(lobby.members.keys());

  if (memberIds.length === 0) return null;

  if (game.presenterUserId && memberIds.includes(game.presenterUserId)) {
    const currentIndex = memberIds.indexOf(game.presenterUserId);
    const nextIndex = (currentIndex + 1) % memberIds.length;
    game.lastPresenterIndex = nextIndex;
    return memberIds[nextIndex];
  }

  if (game.lastPresenterIndex >= 0 && game.lastPresenterIndex < memberIds.length) {
    const nextIndex = (game.lastPresenterIndex + 1) % memberIds.length;
    game.lastPresenterIndex = nextIndex;
    return memberIds[nextIndex];
  }

  game.lastPresenterIndex = 0;
  return memberIds[0];
}

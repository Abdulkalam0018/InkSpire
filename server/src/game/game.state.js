import { maskWord, normalizeSettings } from "./game.config.js";

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
    settings: normalizeSettings(lobby?.settings || {}),
    canvasState: null,
    canvasVersion: 0,
    timerIntervalId: null,
    roundTimeoutId: null,
    intermissionTimeoutId: null
  };
}

export function clearAllTimers(game) {
  if (game.timerIntervalId) {
    clearInterval(game.timerIntervalId);
    game.timerIntervalId = null;
  }
  if (game.roundTimeoutId) {
    clearTimeout(game.roundTimeoutId);
    game.roundTimeoutId = null;
  }
  if (game.intermissionTimeoutId) {
    clearTimeout(game.intermissionTimeoutId);
    game.intermissionTimeoutId = null;
  }
}

export function getRemainingSec(game) {
  if (!game.roundEndsAt) return null;
  return Math.max(0, Math.ceil((game.roundEndsAt - Date.now()) / 1000));
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

export function pickNextPresenter(lobby, game) {
  const memberIds = Array.from(lobby.members.keys());
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

export function buildBaseState(game, lobby, reason) {
  return {
    lobbyId: lobby.id,
    status: game.status,
    round: game.round,
    presenterUserId: game.presenterUserId,
    settings: {
      roundDurationSec: game.settings.roundDurationSec,
      intermissionSec: game.settings.intermissionSec,
      maxRounds: game.settings.maxRounds
    },
    wordLength: game.word ? game.word.length : null,
    timeRemainingSec: getRemainingSec(game),
    scores: buildScoreboard(lobby, game.scores),
    lastRoundResult: game.lastRoundResult,
    reason
  };
}

export function personalizeState(baseState, game, userId) {
  const isPresenter = userId === game.presenterUserId;
  return {
    ...baseState,
    isPresenter,
    word: game.word ? (isPresenter ? game.word : maskWord(game.word)) : null,
    wordOptions:
      game.status === "presenter-choosing" && isPresenter ? game.wordOptions : null
  };
}

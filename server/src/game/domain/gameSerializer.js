import { maskWord } from "./gameWord.js";

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

export function getRemainingSec(game) {
  if (!game.roundEndsAt) return null;
  return Math.max(0, Math.ceil((game.roundEndsAt - Date.now()) / 1000));
}

export function getPresenterChoiceRemainingSec(game) {
  if (!game.presenterChoiceEndsAt) return null;
  return Math.max(0, Math.ceil((game.presenterChoiceEndsAt - Date.now()) / 1000));
}

export function buildBaseGameState(game, lobby, reason) {
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
    presenterChoiceRemainingSec: getPresenterChoiceRemainingSec(game),
    hint: game.hintState
      ? {
          mask: game.hintState.mask,
          revealedCount: game.hintState.revealedCount,
          totalHints: game.hintState.totalHints
        }
      : null,
    scores: buildScoreboard(lobby, game.scores),
    lastRoundResult: game.lastRoundResult,
    reason
  };
}

export function personalizeGameState(baseState, game, userId) {
  const isPresenter = userId === game.presenterUserId;
  const maskedWord = game.hintState?.mask || (game.word ? maskWord(game.word) : null);

  return {
    ...baseState,
    isPresenter,
    word: game.word ? (isPresenter ? game.word : maskedWord) : null,
    wordOptions: game.status === "presenter-choosing" && isPresenter ? game.wordOptions : null
  };
}

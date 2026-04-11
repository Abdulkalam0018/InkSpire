import { maskWord } from "./gameWord.js";
import { buildScoreboard } from "./gameScoreboard.js";

export function getRemainingSec(game) {
  if (!game.roundEndsAt) return null;
  return Math.max(0, Math.ceil((game.roundEndsAt - Date.now()) / 1000));
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
    scores: buildScoreboard(lobby, game.scores),
    lastRoundResult: game.lastRoundResult,
    reason
  };
}

export function personalizeGameState(baseState, game, userId) {
  const isPresenter = userId === game.presenterUserId;

  return {
    ...baseState,
    isPresenter,
    word: game.word ? (isPresenter ? game.word : maskWord(game.word)) : null,
    wordOptions: game.status === "presenter-choosing" && isPresenter ? game.wordOptions : null
  };
}

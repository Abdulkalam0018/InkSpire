export function clearAllGameTimers(game) {
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

  if (game.presenterChoiceTimeoutId) {
    clearTimeout(game.presenterChoiceTimeoutId);
    game.presenterChoiceTimeoutId = null;
  }

  if (Array.isArray(game.hintTimeoutIds) && game.hintTimeoutIds.length > 0) {
    for (const timeoutId of game.hintTimeoutIds) {
      clearTimeout(timeoutId);
    }
    game.hintTimeoutIds = [];
  }
}

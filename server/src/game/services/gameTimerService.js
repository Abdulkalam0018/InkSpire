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
}

import { normalizeSettings } from "./game.config.js";
import { clearAllTimers, createGame } from "./game.state.js";

export function createGameStore() {
  const games = new Map();

  function getGame(lobbyId) {
    return games.get(lobbyId);
  }

  function ensureGame(lobbyId, lobby) {
    let game = games.get(lobbyId);
    if (!game) {
      game = createGame(lobbyId, lobby);
      games.set(lobbyId, game);
    } else {
      game.settings = normalizeSettings(lobby?.settings || {});
    }
    return game;
  }

  function removeGame(lobbyId) {
    const game = games.get(lobbyId);
    if (game) {
      clearAllTimers(game);
    }
    games.delete(lobbyId);
  }

  return {
    getGame,
    ensureGame,
    removeGame
  };
}

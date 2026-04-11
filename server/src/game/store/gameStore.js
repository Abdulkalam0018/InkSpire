import { createGame } from "../domain/gameEntity.js";
import { normalizeGameSettings } from "../domain/gameSettings.js";
import { clearAllGameTimers } from "../services/gameTimerService.js";

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
      game.settings = normalizeGameSettings(lobby?.settings || {});
    }

    return game;
  }

  function removeGame(lobbyId) {
    const game = games.get(lobbyId);
    if (game) {
      clearAllGameTimers(game);
    }

    games.delete(lobbyId);
  }

  return {
    getGame,
    ensureGame,
    removeGame
  };
}

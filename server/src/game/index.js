import { GAME_EVENTS } from "../shared/events/index.js";
import { createGameBroadcastService } from "./services/gameBroadcastService.js";
import { createGameService } from "./services/gameService.js";
import { attachGameSocketHandlers } from "./socket/gameSocketHandlers.js";

export function createGameModule({ io, lobbyStore, gameStore }) {
  const broadcaster = createGameBroadcastService({ io, events: GAME_EVENTS });
  const service = createGameService({ lobbyStore, gameStore, broadcaster });

  return {
    gameStore,
    attachHandlers(socket) {
      attachGameSocketHandlers(socket, service);
    }
  };
}

export { createGameStore } from "./store/gameStore.js";

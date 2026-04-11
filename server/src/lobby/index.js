import { LOBBY_EVENTS } from "../shared/events/index.js";
import { createDisconnectService } from "./services/disconnectService.js";
import { createLobbyService } from "./services/lobbyService.js";
import { attachLobbySocketHandlers } from "./socket/lobbySocketHandlers.js";

export function createLobbyModule({ io, lobbyStore, gameStore }) {
  const configuredDisconnectTtlMs = Number.parseInt(process.env.LOBBY_DISCONNECT_TTL_MS || "", 10);
  const disconnectTtlMs =
    Number.isFinite(configuredDisconnectTtlMs) && configuredDisconnectTtlMs >= 0
      ? configuredDisconnectTtlMs
      : 60 * 1000;

  const disconnectService = createDisconnectService({ ttlMs: disconnectTtlMs });
  const lobbyService = createLobbyService({
    io,
    lobbyStore,
    gameStore,
    disconnectService,
    events: LOBBY_EVENTS
  });

  return {
    lobbyStore,
    attachHandlers(socket) {
      attachLobbySocketHandlers(socket, lobbyService);
    }
  };
}

export { createLobbyStore } from "./store/lobbyStore.js";

import crypto from "crypto";
import {
  normalizeCreateSettings,
  normalizeUpdateSettings
} from "../domain/lobbySettings.js";
import { serializeLobby } from "../domain/lobbySerializer.js";

export function createLobbyStore() {
  const lobbies = new Map();

  function generateLobbyId() {
    const id = crypto.randomBytes(3).toString("hex").toUpperCase();
    if (lobbies.has(id)) return generateLobbyId();
    return id;
  }

  function createLobby(rawSettings, owner) {
    const id = generateLobbyId();
    const lobby = {
      id,
      settings: normalizeCreateSettings(rawSettings, id),
      adminUserId: owner.userId,
      createdAt: new Date().toISOString(),
      members: new Map()
    };

    lobby.members.set(owner.userId, owner);
    lobbies.set(id, lobby);
    return lobby;
  }

  function getLobby(lobbyId) {
    return lobbies.get(lobbyId);
  }

  function addMember(lobbyId, member) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return { error: "Lobby not found" };

    if (lobby.members.has(member.userId)) {
      const existingMember = lobby.members.get(member.userId);
      existingMember.currentSocketId = member.currentSocketId;
      existingMember.isOnline = true;
      return { lobby };
    }

    if (lobby.members.size >= lobby.settings.maxPlayers) {
      return { error: "Lobby is full" };
    }

    lobby.members.set(member.userId, member);
    return { lobby };
  }

  function removeMember(lobbyId, userId) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return null;

    lobby.members.delete(userId);

    if (lobby.members.size === 0) {
      lobbies.delete(lobbyId);
      return { deleted: true };
    }

    if (lobby.adminUserId === userId) {
      const [nextAdmin] = lobby.members.keys();
      lobby.adminUserId = nextAdmin;
    }

    return { lobby };
  }

  function updateSettings(lobbyId, userId, rawSettings) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return { error: "Lobby not found" };

    if (lobby.adminUserId !== userId) {
      return { error: "Only the lobby admin can update settings" };
    }

    const result = normalizeUpdateSettings(rawSettings, lobby.settings, lobby.members.size);
    if (result.error) return { error: result.error };

    lobby.settings = result.settings;
    return { lobby };
  }

  return {
    createLobby,
    getLobby,
    addMember,
    removeMember,
    updateSettings,
    serializeLobby,
    _debug: {
      getCount: () => lobbies.size
    }
  };
}

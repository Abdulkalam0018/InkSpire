import crypto from "crypto";

export function createLobbyStore() {
  const lobbies = new Map();

  const DEFAULT_MAX_PLAYERS = 8;
  const MIN_MAX_PLAYERS = 2;
  const MAX_MAX_PLAYERS = 32;

  function clampNumber(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(Math.max(numeric, min), max);
  }

  function generateLobbyId() {
    // 6-char hex code, easy to read and share (ex: "A1B2C3")
    const id = crypto.randomBytes(3).toString("hex").toUpperCase();
    if (lobbies.has(id)) return generateLobbyId();
    return id;
  }

  function normalizeCreateSettings(rawSettings, lobbyId) {
    const name =
      typeof rawSettings?.name === "string" && rawSettings.name.trim()
        ? rawSettings.name.trim()
        : `Lobby ${lobbyId}`;
    const maxPlayers = clampNumber(
      rawSettings?.maxPlayers,
      DEFAULT_MAX_PLAYERS,
      MIN_MAX_PLAYERS,
      MAX_MAX_PLAYERS
    );
    const isPrivate = Boolean(rawSettings?.isPrivate);

    return { name, maxPlayers, isPrivate };
  }

  function normalizeUpdateSettings(rawSettings, currentSettings, memberCount) {
    const next = { ...currentSettings };

    if (typeof rawSettings?.name === "string" && rawSettings.name.trim()) {
      next.name = rawSettings.name.trim();
    }

    if (rawSettings?.maxPlayers !== undefined) {
      const nextMax = clampNumber(
        rawSettings.maxPlayers,
        currentSettings.maxPlayers,
        MIN_MAX_PLAYERS,
        MAX_MAX_PLAYERS
      );

      if (nextMax < memberCount) {
        return { error: "maxPlayers cannot be less than current members" };
      }

      next.maxPlayers = nextMax;
    }

    if (typeof rawSettings?.isPrivate === "boolean") {
      next.isPrivate = rawSettings.isPrivate;
    }

    return { settings: next };
  }

  function serializeLobby(lobby) {
    return {
      id: lobby.id,
      settings: lobby.settings,
      adminUserId: lobby.adminUserId, // Uses userId now
      createdAt: lobby.createdAt,
      members: Array.from(lobby.members.values()).map((member) => ({
        userId: member.userId,
        name: member.name,
        isOnline: member.isOnline
      }))
    };
  }

  function createLobby(rawSettings, owner) {
    const id = generateLobbyId();
    const lobby = {
      id,
      settings: normalizeCreateSettings(rawSettings, id),
      adminUserId: owner.userId, // Binds lobby ownership to the User
      createdAt: new Date().toISOString(),
      members: new Map()
    };

    lobby.members.set(owner.userId, owner); // Keyed by userId
    lobbies.set(id, lobby);
    return lobby;
  }

  function getLobby(lobbyId) {
    return lobbies.get(lobbyId);
  }

  function addMember(lobbyId, member) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return { error: "Lobby not found" };

    // Reconnection handling: Update socket ID and status if user already exists
    if (lobby.members.has(member.userId)) {
      const existingMember = lobby.members.get(member.userId);
      existingMember.currentSocketId = member.currentSocketId;
      existingMember.isOnline = true;
      return { lobby };
    }

    if (lobby.members.size >= lobby.settings.maxPlayers) {
      return { error: "Lobby is full" };
    }

    lobby.members.set(member.userId, member); // Keyed by userId
    return { lobby };
  }

  function removeMember(lobbyId, userId) { // Accepts userId
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

  function updateSettings(lobbyId, userId, rawSettings) { // Accepts userId
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return { error: "Lobby not found" };

    if (lobby.adminUserId !== userId) {
      return { error: "Only the lobby admin can update settings" };
    }

    const result = normalizeUpdateSettings(
      rawSettings,
      lobby.settings,
      lobby.members.size
    );
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
    serializeLobby
  };
}
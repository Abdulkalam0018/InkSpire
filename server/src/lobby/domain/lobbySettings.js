import { clampNumber, normalizeNonEmptyString } from "../../shared/validation/commonValidators.js";

export const DEFAULT_MAX_PLAYERS = 8;
export const MIN_MAX_PLAYERS = 2;
export const MAX_MAX_PLAYERS = 32;

export function normalizeCreateSettings(rawSettings, lobbyId) {
  const fallbackName = `Lobby ${lobbyId}`;
  const name = normalizeNonEmptyString(rawSettings?.name, fallbackName);
  const maxPlayers = clampNumber(
    rawSettings?.maxPlayers,
    DEFAULT_MAX_PLAYERS,
    MIN_MAX_PLAYERS,
    MAX_MAX_PLAYERS
  );
  const isPrivate = Boolean(rawSettings?.isPrivate);

  return { name, maxPlayers, isPrivate };
}

export function normalizeUpdateSettings(rawSettings, currentSettings, memberCount) {
  const next = { ...currentSettings };

  if (rawSettings?.name !== undefined) {
    next.name = normalizeNonEmptyString(rawSettings.name, currentSettings.name);
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

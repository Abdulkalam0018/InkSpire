export function createDisconnectService({ ttlMs = 60 * 1000 } = {}) {
  const cleanupTimers = new Map();

  function timerKey(lobbyId, userId) {
    return `${lobbyId}:${userId}`;
  }

  function clear(lobbyId, userId) {
    if (!lobbyId || !userId) return;

    const key = timerKey(lobbyId, userId);
    const timerId = cleanupTimers.get(key);
    if (!timerId) return;

    clearTimeout(timerId);
    cleanupTimers.delete(key);
  }

  function schedule(lobbyId, userId, onExpire) {
    if (!lobbyId || !userId || typeof onExpire !== "function") return;

    clear(lobbyId, userId);

    const key = timerKey(lobbyId, userId);
    const timerId = setTimeout(async () => {
      cleanupTimers.delete(key);
      await onExpire({ lobbyId, userId });
    }, ttlMs);

    cleanupTimers.set(key, timerId);
  }

  function clearAll() {
    for (const timerId of cleanupTimers.values()) {
      clearTimeout(timerId);
    }
    cleanupTimers.clear();
  }

  return {
    clear,
    schedule,
    clearAll
  };
}

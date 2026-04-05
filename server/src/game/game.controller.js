const DEFAULT_WORD_BANK = ["apple", "river", "mountain", "pencil", "spaceship", "dragon", "guitar", "castle", "meteor", "robot", "island", "flower", "camera", "tiger", "bridge", "planet", "forest", "lighthouse", "piano", "rocket", "ocean", "butterfly", "volcano", "cabin", "rainbow", "desert", "comet", "library", "whisper", "scooter", "anchor", "balloon", "bamboo", "beacon", "beehive", "blizzard", "blueberry", "bonfire", "bookstore", "cactus", "carousel", "cedar", "chameleon", "chimney", "cinnamon", "cliff", "coconut", "compass", "copper", "coral", "cottage", "crater", "crystal", "cupcake", "dandelion", "dolphin", "drizzle", "eagle", "ember", "envelope", "fabric", "falcon", "fossil", "fountain", "galaxy", "garden", "glacier", "glowworm", "granite", "harbor", "hedgehog", "helmet", "horizon", "honeycomb", "jasmine", "jigsaw", "kayak", "kettle", "lantern", "lavender", "lemonade", "lullaby", "magnet", "mango", "marble", "meadow", "midnight", "monsoon", "mosaic", "mushroom", "nebula", "notebook", "oasis", "orchid", "origami", "parachute", "pebble", "pepper", "pinecone", "postcard", "quartz", "quiver", "raincoat", "raspberry", "reef", "riddle", "sapphire", "scarecrow", "seashell", "shadow", "shamrock", "sketch", "snowflake", "sparrow", "starlight", "stonebridge", "sunflower", "sunset", "telescope", "thunder", "timber", "topaz", "torch", "tornado", "tram", "treasure", "tulip", "umbrella", "voyage", "waterfall"];

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
}

function normalizeSettings(raw = {}) {
  const roundDurationSec = clampNumber(raw.roundDurationSec, 60, 20, 180);
  const intermissionSec = clampNumber(raw.intermissionSec, 6, 3, 20);
  const maxRounds = clampNumber(raw.maxRounds, 5, 1, 20);

  const customBank = Array.isArray(raw.wordBank || raw.words)
    ? (raw.wordBank || raw.words)
        .filter((word) => typeof word === "string" && word.trim())
        .map((word) => word.trim().toLowerCase())
    : [];

  return {
    roundDurationSec,
    intermissionSec,
    maxRounds,
    wordBank: customBank.length > 0 ? customBank : DEFAULT_WORD_BANK
  };
}

function pickWordOptions(wordBank, count = 3) {
  const pool = [...wordBank];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function normalizeWordInput(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function maskWord(word) {
  if (!word) return null;
  return word
    .split("")
    .map((char) => (char === " " ? " " : "_"))
    .join("");
}

function createGame(lobbyId, lobby) {
  return {
    lobbyId,
    status: "idle", // idle | presenter-choosing | in-round | round-ended | game-over
    round: 0,
    presenterSocketId: null,
    word: null,
    wordOptions: [],
    roundStartedAt: null,
    roundEndsAt: null,
    scores: new Map(),
    guessedThisRound: new Set(),
    lastPresenterIndex: -1,
    lastRoundResult: null,
    settings: normalizeSettings(lobby?.settings || {}),
    timerIntervalId: null,
    roundTimeoutId: null,
    intermissionTimeoutId: null
  };
}

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

function clearAllTimers(game) {
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

function getRemainingSec(game) {
  if (!game.roundEndsAt) return null;
  return Math.max(0, Math.ceil((game.roundEndsAt - Date.now()) / 1000));
}

function syncMembers(game, lobby) {
  for (const member of lobby.members.values()) {
    if (!game.scores.has(member.socketId)) {
      game.scores.set(member.socketId, 0);
    }
  }

  for (const socketId of game.scores.keys()) {
    if (!lobby.members.has(socketId)) {
      game.scores.delete(socketId);
      game.guessedThisRound.delete(socketId);
    }
  }
}

function buildScoreboard(lobby, scores) {
  const list = [];
  for (const member of lobby.members.values()) {
    list.push({
      socketId: member.socketId,
      name: member.name,
      score: scores.get(member.socketId) || 0
    });
  }

  list.sort((a, b) => b.score - a.score);
  return list;
}

function pickNextPresenter(lobby, game) {
  const memberIds = Array.from(lobby.members.keys());
  if (memberIds.length === 0) return null;

  if (game.presenterSocketId && memberIds.includes(game.presenterSocketId)) {
    const currentIndex = memberIds.indexOf(game.presenterSocketId);
    const nextIndex = (currentIndex + 1) % memberIds.length;
    game.lastPresenterIndex = nextIndex;
    return memberIds[nextIndex];
  }

  if (game.lastPresenterIndex >= 0 && game.lastPresenterIndex < memberIds.length) {
    const nextIndex = (game.lastPresenterIndex + 1) % memberIds.length;
    game.lastPresenterIndex = nextIndex;
    return memberIds[nextIndex];
  }

  game.lastPresenterIndex = 0;
  return memberIds[0];
}

function buildBaseState(game, lobby, reason) {
  return {
    lobbyId: lobby.id,
    status: game.status,
    round: game.round,
    presenterSocketId: game.presenterSocketId,
    settings: {
      roundDurationSec: game.settings.roundDurationSec,
      intermissionSec: game.settings.intermissionSec,
      maxRounds: game.settings.maxRounds
    },
    wordLength: game.word ? game.word.length : null,
    timeRemainingSec: getRemainingSec(game),
    scores: buildScoreboard(lobby, game.scores),
    lastRoundResult: game.lastRoundResult,
    reason
  };
}

function personalizeState(baseState, game, socketId) {
  const isPresenter = socketId === game.presenterSocketId;
  return {
    ...baseState,
    isPresenter,
    word: game.word ? (isPresenter ? game.word : maskWord(game.word)) : null,
    wordOptions:
      game.status === "presenter-choosing" && isPresenter ? game.wordOptions : null
  };
}

export function handleGameEvents(io, socket, lobbyStore, gameStore) {
  function emitError(ack, message) {
    socket.emit("game:error", { message });
    if (typeof ack === "function") {
      ack({ ok: false, error: message });
    }
  }

  function resolveLobbyId(payload) {
    if (typeof payload?.lobbyId === "string" && payload.lobbyId.trim()) {
      return payload.lobbyId.trim().toUpperCase();
    }
    return socket.data?.lobbyId || "";
  }

  function getLobbyOrError(payload, ack) {
    const lobbyId = resolveLobbyId(payload);
    if (!lobbyId) {
      emitError(ack, "Lobby code is required");
      return null;
    }

    const lobby = lobbyStore.getLobby(lobbyId);
    if (!lobby) {
      emitError(ack, "Lobby not found");
      return null;
    }

    return lobby;
  }

  function emitGameState(lobby, game, reason) {
    syncMembers(game, lobby);
    const baseState = buildBaseState(game, lobby, reason);

    for (const member of lobby.members.values()) {
      const stateForMember = personalizeState(baseState, game, member.socketId);
      io.to(member.socketId).emit("game:state", stateForMember);
    }
  }

  function emitGameStateToSocket(lobby, game, socketId, reason) {
    syncMembers(game, lobby);
    const baseState = buildBaseState(game, lobby, reason);
    const stateForMember = personalizeState(baseState, game, socketId);
    io.to(socketId).emit("game:state", stateForMember);
  }

  function emitPresenterOptions(lobby, game) {
    if (!game.presenterSocketId) return;
    io.to(game.presenterSocketId).emit("game:presenter", {
      lobbyId: lobby.id,
      round: game.round,
      options: game.wordOptions
    });
  }

  function beginPresenterSelection(lobby, game, reason) {
    clearAllTimers(game);
    game.status = "presenter-choosing";
    game.word = null;
    game.wordOptions = pickWordOptions(game.settings.wordBank, 3);
    game.guessedThisRound = new Set();
    game.roundStartedAt = null;
    game.roundEndsAt = null;
    game.presenterSocketId = pickNextPresenter(lobby, game);
    game.lastRoundResult = null;

    emitGameState(lobby, game, reason);
    emitPresenterOptions(lobby, game);
  }

  function startRound(lobby, game, word) {
    clearAllTimers(game);
    game.word = word;
    game.status = "in-round";
    game.guessedThisRound = new Set();
    game.roundStartedAt = Date.now();
    game.roundEndsAt = game.roundStartedAt + game.settings.roundDurationSec * 1000;

    emitGameState(lobby, game, "round-start");

    game.timerIntervalId = setInterval(() => {
      if (game.status !== "in-round") return;
      emitGameState(lobby, game, "tick");
    }, 1000);

    game.roundTimeoutId = setTimeout(() => {
      endRound(lobby, game, "time");
    }, game.settings.roundDurationSec * 1000);
  }

  function endGame(lobby, game, reason) {
    clearAllTimers(game);
    game.status = "game-over";
    game.word = null;
    game.wordOptions = [];
    game.roundStartedAt = null;
    game.roundEndsAt = null;

    emitGameState(lobby, game, "game-over");
    io.to(lobby.id).emit("game:over", {
      reason,
      scores: buildScoreboard(lobby, game.scores)
    });
  }

  function startNextRound(lobby, game) {
    game.round += 1;
    beginPresenterSelection(lobby, game, "next-round");
  }

  function endRound(lobby, game, reason, winnerSocketId = null) {
    if (game.status !== "in-round" && game.status !== "presenter-choosing") return;

    clearAllTimers(game);
    game.status = "round-ended";
    game.lastRoundResult = {
      reason,
      winnerSocketId,
      word: game.word,
      endedAt: new Date().toISOString()
    };

    emitGameState(lobby, game, "round-ended");
    io.to(lobby.id).emit("game:roundEnded", game.lastRoundResult);

    if (game.round >= game.settings.maxRounds) {
      endGame(lobby, game, "max-rounds");
      return;
    }

    game.intermissionTimeoutId = setTimeout(() => {
      if (game.status !== "round-ended") return;
      startNextRound(lobby, game);
    }, game.settings.intermissionSec * 1000);
  }

  function startNewGame(lobby, game) {
    clearAllTimers(game);
    game.status = "idle";
    game.round = 1;
    game.presenterSocketId = null;
    game.word = null;
    game.wordOptions = [];
    game.roundStartedAt = null;
    game.roundEndsAt = null;
    game.guessedThisRound = new Set();
    game.lastPresenterIndex = -1;
    game.lastRoundResult = null;

    game.scores = new Map();
    syncMembers(game, lobby);

    beginPresenterSelection(lobby, game, "game-start");
  }

  function handleCorrectGuess(lobby, game, socketId) {
    if (game.guessedThisRound.has(socketId)) return;

    const remaining = getRemainingSec(game) || 0;
    const basePoints = 100;
    const timeBonus = remaining;

    const currentScore = game.scores.get(socketId) || 0;
    game.scores.set(socketId, currentScore + basePoints + timeBonus);
    game.guessedThisRound.add(socketId);

    io.to(lobby.id).emit("game:guessCorrect", { socketId });

    const nonPresenterCount = Math.max(0, lobby.members.size - 1);
    if (nonPresenterCount > 0 && game.guessedThisRound.size >= nonPresenterCount) {
      endRound(lobby, game, "all-guessed", socketId);
    } else {
      emitGameState(lobby, game, "score");
    }
  }

  socket.on("game:start", (payload = {}, ack) => {
    const lobby = getLobbyOrError(payload, ack);
    if (!lobby) return;

    if (lobby.adminSocketId !== socket.id) {
      emitError(ack, "Only the lobby admin can start the game");
      return;
    }

    const game = gameStore.ensureGame(lobby.id, lobby);

    if (game.status !== "idle" && game.status !== "game-over" && !payload.force) {
      emitError(ack, "Game already running (use force to restart)");
      return;
    }

    if (lobby.members.size < 2) {
      emitError(ack, "Need at least 2 players to start a game");
      return;
    }

    startNewGame(lobby, game);

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("game:chooseWord", (payload = {}, ack) => {
    const lobby = getLobbyOrError(payload, ack);
    if (!lobby) return;

    const game = gameStore.getGame(lobby.id);
    if (!game) {
      emitError(ack, "Game not started");
      return;
    }

    if (game.status !== "presenter-choosing") {
      emitError(ack, "Not ready for word selection");
      return;
    }

    if (socket.id !== game.presenterSocketId) {
      emitError(ack, "Only the presenter can choose the word");
      return;
    }

    const chosen = normalizeWordInput(payload.word);
    if (!chosen) {
      emitError(ack, "Word is required");
      return;
    }

    if (!game.wordOptions.includes(chosen)) {
      emitError(ack, "Word must be selected from provided options");
      return;
    }

    startRound(lobby, game, chosen);

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("game:guess", (payload = {}, ack) => {
    const lobby = getLobbyOrError(payload, ack);
    if (!lobby) return;

    const game = gameStore.getGame(lobby.id);
    if (!game) {
      emitError(ack, "Game not started");
      return;
    }

    if (game.status !== "in-round") {
      emitError(ack, "No active round");
      return;
    }

    if (socket.id === game.presenterSocketId) {
      emitError(ack, "Presenter cannot guess");
      return;
    }

    const guess = normalizeWordInput(payload.guess);
    if (!guess) {
      emitError(ack, "Guess is required");
      return;
    }

    if (guess === game.word) {
      handleCorrectGuess(lobby, game, socket.id);
      if (typeof ack === "function") {
        ack({ ok: true, correct: true });
      }
      return;
    }

    if (typeof ack === "function") {
      ack({ ok: true, correct: false });
    }
  });

  socket.on("game:nextRound", (payload = {}, ack) => {
    const lobby = getLobbyOrError(payload, ack);
    if (!lobby) return;

    const game = gameStore.getGame(lobby.id);
    if (!game) {
      emitError(ack, "Game not started");
      return;
    }

    if (lobby.adminSocketId !== socket.id) {
      emitError(ack, "Only the lobby admin can advance rounds");
      return;
    }

    if (game.status !== "round-ended") {
      emitError(ack, "Round has not ended yet");
      return;
    }

    startNextRound(lobby, game);

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("game:stop", (payload = {}, ack) => {
    const lobby = getLobbyOrError(payload, ack);
    if (!lobby) return;

    const game = gameStore.getGame(lobby.id);
    if (!game) {
      emitError(ack, "Game not started");
      return;
    }

    if (lobby.adminSocketId !== socket.id) {
      emitError(ack, "Only the lobby admin can stop the game");
      return;
    }

    endGame(lobby, game, "stopped");

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("game:sync", (payload = {}, ack) => {
    const lobby = getLobbyOrError(payload, ack);
    if (!lobby) return;

    const game = gameStore.getGame(lobby.id);
    if (!game) {
      emitError(ack, "Game not started");
      return;
    }

    emitGameStateToSocket(lobby, game, socket.id, "sync");

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("disconnect", () => {
    const lobbyId = socket.data?.lobbyId;
    if (!lobbyId) return;

    const lobby = lobbyStore.getLobby(lobbyId);
    const game = gameStore.getGame(lobbyId);
    
    if (!game) return;

    if(!lobby || lobby.members.size === 0) {
      gameStore.removeGame(lobbyId);
      return;
    }


    game.scores.delete(socket.id);
    game.guessedThisRound.delete(socket.id);

    if (game.presenterSocketId === socket.id) {
      if (game.status === "presenter-choosing") {
        beginPresenterSelection(lobby, game, "presenter-left");
        return;
      }

      if (game.status === "in-round") {
        endRound(lobby, game, "presenter-left");
        return;
      }
    }

    emitGameState(lobby, game, "player-left");
  });
}

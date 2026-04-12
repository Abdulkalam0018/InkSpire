export const LOBBY_EVENTS = {
  CREATE: "lobby:create",
  JOIN: "lobby:join",
  LEAVE: "lobby:leave",
  KICK: "lobby:kick",
  UPDATE_SETTINGS: "lobby:updateSettings",
  STATE: "lobby:state",
  LEFT: "lobby:left",
  KICKED: "lobby:kicked",
  ERROR: "lobby:error"
};

export const GAME_EVENTS = {
  START: "game:start",
  CHOOSE_WORD: "game:chooseWord",
  GUESS: "game:guess",
  NEXT_ROUND: "game:nextRound",
  STOP: "game:stop",
  SYNC: "game:sync",
  STATE: "game:state",
  OVER: "game:over",
  ROUND_ENDED: "game:roundEnded",
  PRESENTER_OPTIONS: "game:presenterOptions",
  ERROR: "game:error",
  GUESS_CORRECT: "game:guessCorrect",
  CHAT_SEND: "game:chat:send",
  CHAT_MESSAGE: "game:chat:message",
  CHAT_SYSTEM: "game:chat:system",
  CHAT_BACKFILL: "game:chat:backfill",
  HINT_UPDATE: "game:hint:update",
  WORD_REVEALED: "game:word:revealed",
  PRESENTER_TIMEOUT: "game:presenter:timeout",
  CANVAS_SYNC: "game:canvas:sync",
  CANVAS_UPDATE: "game:canvas:update",
  CANVAS_CLEAR: "game:canvas:clear",
  CANVAS_STATE: "game:canvasState"
};

export const SYSTEM_EVENTS = {
  CLIENT_PING: "client:ping",
  SERVER_PONG: "server:pong"
};

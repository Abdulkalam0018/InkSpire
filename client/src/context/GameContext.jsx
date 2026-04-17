import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSocket } from "./SocketContext.jsx";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { socket, isConnected, isReconnecting, connectionError } = useSocket();

  const [gameState, setGameState] = useState(null);
  const [gameError, setGameError] = useState(null);
  const [chatFeed, setChatFeed] = useState([]);
  const [hintState, setHintState] = useState(null);
  const [wordReveal, setWordReveal] = useState(null);
  const [presenterTimeoutNotice, setPresenterTimeoutNotice] = useState(null);
  const [gameOverState, setGameOverState] = useState(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleGameState = (state) => {
      setGameState(state || null);
      setHintState(state?.hint || null);

      if (!state) {
        setWordReveal(null);
        setPresenterTimeoutNotice(null);
        setGameOverState(null);
      } else if (
        state.reason === "round-start" ||
        state.reason === "next-round" ||
        state.reason === "game-start"
      ) {
        setWordReveal(null);
        setPresenterTimeoutNotice(null);
        setGameOverState(null);

        if (state.reason === "game-start") {
          setChatFeed([]);
        }
      }

      if (state?.reason === "game-over") {
        setHintState(null);
      }

      setGameError(null);
    };

    const handleGameError = (err) => {
      setGameError(err?.message || "Game error");
    };

    const handleChatMessage = (message) => {
      setChatFeed((prev) => [...prev, { ...message, kind: message?.kind || "chat" }].slice(-100));
    };

    const handleChatSystem = (message) => {
      setChatFeed((prev) => [...prev, { ...message, kind: "system" }].slice(-100));
    };

    const handleChatBackfill = (payload = {}) => {
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      setChatFeed(messages.slice(-100));
    };

    const handleHintUpdate = (payload) => {
      setHintState(payload?.hint || null);
    };

    const handleWordRevealed = (payload) => {
      setWordReveal(payload || null);
    };

    const handlePresenterTimeout = (payload) => {
      setPresenterTimeoutNotice(payload || null);
    };

    const handleGameOver = (payload = {}) => {
      const scores = Array.isArray(payload.scores) ? payload.scores : [];
      setGameOverState({
        reason: payload.reason || "game-over",
        scores
      });
    };

    socket.on("game:state", handleGameState);
    socket.on("game:error", handleGameError);
    socket.on("game:chat:message", handleChatMessage);
    socket.on("game:chat:system", handleChatSystem);
    socket.on("game:chat:backfill", handleChatBackfill);
    socket.on("game:hint:update", handleHintUpdate);
    socket.on("game:word:revealed", handleWordRevealed);
    socket.on("game:presenter:timeout", handlePresenterTimeout);
    socket.on("game:over", handleGameOver);

    socket.emit("game:sync");

    return () => {
      socket.off("game:state", handleGameState);
      socket.off("game:error", handleGameError);
      socket.off("game:chat:message", handleChatMessage);
      socket.off("game:chat:system", handleChatSystem);
      socket.off("game:chat:backfill", handleChatBackfill);
      socket.off("game:hint:update", handleHintUpdate);
      socket.off("game:word:revealed", handleWordRevealed);
      socket.off("game:presenter:timeout", handlePresenterTimeout);
      socket.off("game:over", handleGameOver);
    };
  }, [socket, isConnected]); 

  const emitWithAck = useCallback(
    (event, payload = {}) =>
      new Promise((resolve) => {
        if (!socket || !isConnected) {
          const error = "Socket not connected";
          setGameError(error);
          resolve({ ok: false, error });
          return;
        }

        socket.emit(event, payload, (res) => {
          if (res?.ok === false) {
            setGameError(res?.error || "Game error");
          } else {
            setGameError(null);
          }
          resolve(res || { ok: true });
        });
      }),
    [socket, isConnected]
  );

  const chooseWord = useCallback(
    (word) => {
      return emitWithAck("game:chooseWord", { word });
    },
    [emitWithAck]
  );

  const submitGuess = useCallback(
    (guess) => {
      return emitWithAck("game:guess", { guess });
    },
    [emitWithAck]
  );

  const syncGame = useCallback(() => {
    return emitWithAck("game:sync");
  }, [emitWithAck]);

  const sendChatMessage = useCallback(
    (message) => {
      return emitWithAck("game:chat:send", { message });
    },
    [emitWithAck]
  );

  const clearGameError = useCallback(() => {
    setGameError(null);
  }, []);

  const presenterName = useMemo(() => {
    if (!gameState?.presenterUserId || !gameState?.scores) return null;
    const presenter = gameState.scores.find(
      (player) => player.userId === gameState.presenterUserId
    );
    return presenter?.name || "Presenter";
  }, [gameState]);

  const resolvedGameError = gameError || connectionError;
  const isGameOver = gameState?.status === "game-over";

  const value = useMemo(() => {
    const canGuess = Boolean(gameState) && gameState.status === "in-round" && !gameState.isPresenter;

    return {
      socket,
      gameState,
      gameError: resolvedGameError,
      setGameError,
      clearGameError,
      socketStatus: isConnected ? "connected" : isReconnecting ? "reconnecting" : "disconnected",
      socketId: socket?.id || null,
      chatFeed,
      hintState,
      wordReveal,
      presenterTimeoutNotice,
      gameOverState,
      isGameOver,
      presenterName,
      canGuess,
      chooseWord,
      submitGuess,
      syncGame,
      sendChatMessage
    };
  }, [
    socket,
    gameState,
    resolvedGameError,
    chatFeed,
    hintState,
    wordReveal,
    presenterTimeoutNotice,
    gameOverState,
    isGameOver,
    isConnected,
    isReconnecting,
    presenterName,
    chooseWord,
    submitGuess,
    syncGame,
    sendChatMessage,
    clearGameError
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSocket } from "./SocketContext.jsx";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { socket, isConnected, isReconnecting, connectionError } = useSocket();

  const [gameState, setGameState] = useState(null);
  const [gameError, setGameError] = useState(null);

  useEffect(() => {
    if (connectionError) {
      setGameError(connectionError);
    }
  }, [connectionError]);

  useEffect(() => {
    if (!socket) return;

    const handleGameState = (state) => {
      setGameState(state || null);
      setGameError(null);
    };

    const handleGameError = (err) => {
      setGameError(err?.message || "Game error");
    };

    socket.on("game:state", handleGameState);
    socket.on("game:error", handleGameError);

    socket.emit("game:sync");

    return () => {
      socket.off("game:state", handleGameState);
      socket.off("game:error", handleGameError);
    };
  }, [socket]);

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

  const presenterName = useMemo(() => {
    if (!gameState?.presenterUserId || !gameState?.scores) return null;
    const presenter = gameState.scores.find(
      (player) => player.userId === gameState.presenterUserId
    );
    return presenter?.name || "Presenter";
  }, [gameState]);

  const canGuess =
    Boolean(gameState) && gameState.status === "in-round" && !gameState.isPresenter;

  const value = useMemo(
    () => ({
      socket,
      gameState,
      gameError,
      setGameError,
      clearGameError: () => setGameError(null),
      socketStatus: isConnected ? "connected" : isReconnecting ? "reconnecting" : "disconnected",
      socketId: socket?.id || null,
      presenterName,
      canGuess,
      chooseWord,
      submitGuess,
      syncGame
    }),
    [
      socket,
      gameState,
      gameError,
      isConnected,
      isReconnecting,
      presenterName,
      canGuess,
      chooseWord,
      submitGuess,
      syncGame
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext.jsx";
import DrawingBoard from "../components/canvas/DrawingBoard.jsx";

export default function Game() {
  const { socket, isConnected, isReconnecting, connectionError } = useSocket();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState(null);
  const [gameError, setGameError] = useState(null);
  const [guess, setGuess] = useState("");
  const [guessResult, setGuessResult] = useState(null);

  const socketStatus = isConnected ? "connected" : isReconnecting ? "reconnecting" : "disconnected";
  const socketId = socket?.id || null;

  useEffect(() => {
    if (connectionError) {
      setGameError(connectionError);
    }
  }, [connectionError]);

  useEffect(() => {
    if (!socket) return;

    const handleGameState = (state) => {
      setGameState(state);
      setGameError(null);
      if (state?.reason && state.reason !== "tick") {
        setGuessResult(null);
      }
      if (state?.status !== "in-round") {
        setGuess("");
      }
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

  const presenterName = useMemo(() => {
    if (!gameState?.presenterUserId || !gameState?.scores) return null;
    const presenter = gameState.scores.find(
      (player) => player.userId === gameState.presenterUserId
    );
    return presenter?.name || "Presenter";
  }, [gameState]);

  function emitWithAck(event, payload, onSuccess) {
    if (!socket || !isConnected) {
      setGameError("Socket not connected");
      return;
    }

    socket.emit(event, payload, (res) => {
      if (res?.ok === false) {
        setGameError(res?.error || "Game error");
        return;
      }
      if (typeof onSuccess === "function") {
        onSuccess(res);
      }
    });
  }

  function handleChooseWord(word) {
    emitWithAck("game:chooseWord", { word });
  }

  function handleGuessSubmit(event) {
    event.preventDefault();
    emitWithAck("game:guess", { guess }, (res) => {
      if (res?.correct) {
        setGuessResult("Correct!");
      } else {
        setGuessResult("Not quite.");
      }
      if (res?.correct) {
        setGuess("");
      }
    });
  }

  function handleBackToLobby() {
    navigate("/");
  }

  const canGuess =
    Boolean(gameState) && gameState.status === "in-round" && !gameState.isPresenter;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>InkSpire Game</h1>
          <p className="subtitle">Play the round, track scores, and guess the word.</p>
        </div>
        <div className="status-pill">
          Socket: {socketStatus} {socketId ? `(${socketId.slice(0, 6)})` : ""}
        </div>
      </header>

      <section className="card">
        <div className="page-header">
          <div>
            <h2>Game Status</h2>
            <p className="subtitle">
              {gameState
                ? `Round ${gameState.round} · ${gameState.status}`
                : "Waiting for game state..."}
            </p>
          </div>
          <button className="secondary" onClick={handleBackToLobby}>
            Back to Lobby
          </button>
        </div>

        <div className="pill-row">
          <span className="pill">
            Presenter: {presenterName || "Waiting for players"}
          </span>
          <span className="pill">
            Time Left:{" "}
            {gameState?.timeRemainingSec !== null && gameState?.timeRemainingSec !== undefined
              ? `${gameState.timeRemainingSec}s`
              : "—"}
          </span>
          <span className="pill">
            Round {gameState?.round ?? 0}/{gameState?.settings?.maxRounds ?? "—"}
          </span>
        </div>

        {gameError ? <div className="error">{gameError}</div> : null}
        {guessResult ? <div className="note">{guessResult}</div> : null}
      </section>

      <section className="card">
        <h2>Word</h2>
        {gameState?.word ? (
          <p className="subtitle" style={{ fontSize: "1.4rem", letterSpacing: "0.2rem" }}>
            {gameState.word}
          </p>
        ) : (
          <p className="muted">No word selected yet.</p>
        )}

        {gameState?.status === "presenter-choosing" ? (
          gameState.isPresenter ? (
            <div className="grid" style={{ marginTop: "16px" }}>
              <p className="note">Choose a word to start the round.</p>
              <div className="row">
                {(gameState.wordOptions || []).map((option) => (
                  <button key={option} onClick={() => handleChooseWord(option)}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="note">Waiting for the presenter to choose a word.</p>
          )
        ) : null}
      </section>

      <section className="card">
        <h2>Guess</h2>
        {canGuess ? (
          <form className="grid" onSubmit={handleGuessSubmit}>
            <input
              value={guess}
              onChange={(event) => {
                setGuess(event.target.value);
                setGuessResult(null);
              }}
              placeholder="Your guess"
            />
            <button type="submit" disabled={!guess.trim()}>
              Submit Guess
            </button>
          </form>
        ) : gameState?.isPresenter ? (
          <p className="note">You are the presenter this round.</p>
        ) : (
          <p className="muted">Guesses open when the round starts.</p>
        )}
      </section>

      <section className="card">
        <h2>Canvas</h2>
        <DrawingBoard
          socket={socket}
          gameState={gameState}
          onError={(message) => setGameError(message)}
        />
      </section>

      <section className="card">
        <h2>Scoreboard</h2>
        {gameState?.scores?.length ? (
          <ul className="list">
            {gameState.scores.map((player) => (
              <li key={player.userId}>
                {player.name}
                {player.userId === gameState.presenterUserId ? " (presenter)" : ""}
                {!player.isOnline ? " (offline)" : ""} —{" "}
                {player.score}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No scores yet.</p>
        )}
      </section>
    </div>
  );
}

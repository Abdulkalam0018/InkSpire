import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../context/GameContext.jsx";
import { useLobby } from "../../context/LobbyContext.jsx";
import GameOverlay from "./GameOverlay.jsx";

function getGameOverSubtitle(reason) {
  if (reason === "max-rounds") return "All rounds completed.";
  if (reason === "insufficient-active-players") return "Game ended because there are not enough active players.";
  if (reason === "stopped") return "Game was stopped by the lobby admin.";
  return "This match has ended.";
}

function getSortedScores(scores) {
  const normalizedScores = Array.isArray(scores) ? [...scores] : [];

  normalizedScores.sort((a, b) => {
    const scoreDiff = (b?.score || 0) - (a?.score || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const nameA = (a?.name || "").toLowerCase();
    const nameB = (b?.name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return normalizedScores;
}

export default function GameOverOverlay() {
  const { gameState, gameOverState, isGameOver } = useGame();
  const { isAdmin, startGame, leaveLobby } = useLobby();
  const navigate = useNavigate();
  const [isRestarting, setIsRestarting] = useState(false);
  const [isLeavingLobby, setIsLeavingLobby] = useState(false);
  const [actionError, setActionError] = useState(null);

  const scores = useMemo(
    () => getSortedScores(gameOverState?.scores || gameState?.scores || []),
    [gameOverState?.scores, gameState?.scores]
  );

  const gameOverReason = gameOverState?.reason;
  const subtitle = getGameOverSubtitle(gameOverReason);

  async function handleStartNewGame() {
    if (!gameState?.lobbyId || !isAdmin || isRestarting) return;

    setActionError(null);
    setIsRestarting(true);

    const result = await startGame({
      lobbyId: gameState.lobbyId,
      force: true
    });

    if (result?.ok === false) {
      setActionError(result.error || "Unable to start a new game");
      setIsRestarting(false);
      return;
    }

    setIsRestarting(false);
  }

  async function handleLeaveLobby() {
    if (isLeavingLobby) return;

    setActionError(null);
    setIsLeavingLobby(true);

    const result = await leaveLobby();

    if (result?.ok === false) {
      setActionError(result.error || "Unable to leave the lobby");
      setIsLeavingLobby(false);
      return;
    }

    setIsLeavingLobby(false);
    navigate("/", { replace: true });
  }

  return (
    <GameOverlay
      open={isGameOver}
      title="Game Over"
      subtitle={subtitle}
      actions={
        <>
          {!isAdmin ? <div className="note">Waiting for the lobby admin to start a new game.</div> : null}
          {isAdmin ? (
            <button
              type="button"
              onClick={handleStartNewGame}
              disabled={isRestarting || isLeavingLobby}
            >
              {isRestarting ? "Starting..." : "Start New Game"}
            </button>
          ) : null}
          <button
            type="button"
            className="secondary"
            onClick={handleLeaveLobby}
            disabled={isLeavingLobby || isRestarting}
          >
            {isLeavingLobby ? "Leaving..." : "Leave Lobby"}
          </button>
        </>
      }
    >
      <section className="game-overlay-leaderboard">
        <h3>Leaderboard</h3>

        {scores.length ? (
          <ol className="list game-overlay-score-list">
            {scores.map((player, index) => (
              <li
                key={player.userId || `${player.name}-${index}`}
                className={`game-overlay-score-item${index === 0 ? " is-winner" : ""}`}
              >
                <div className="game-overlay-rank">#{index + 1}</div>
                <div className="game-overlay-player-meta">
                  <strong>{player.name || "Player"}</strong>
                  {!player.isOnline ? <span className="game-overlay-player-status">Offline</span> : null}
                </div>
                <strong className="game-overlay-points">{player.score || 0}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">No scores were recorded for this game.</p>
        )}

        {actionError ? <div className="error">{actionError}</div> : null}
      </section>
    </GameOverlay>
  );
}

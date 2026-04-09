import { useNavigate } from "react-router-dom";
import { useGame } from "../../context/GameContext.jsx";

export default function GameStatusCard() {
  const { gameState, presenterName, gameError } = useGame();
  const navigate = useNavigate();

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h2>Game Status</h2>
          <p className="subtitle">
            {gameState
              ? `Round ${gameState.round} - ${gameState.status}`
              : "Waiting for game state..."}
          </p>
        </div>
        <button className="secondary" onClick={() => navigate("/")}>
          Back to Lobby
        </button>
      </div>

      <div className="pill-row">
        <span className="pill">Presenter: {presenterName || "Waiting for players"}</span>
        <span className="pill">
          Time Left:{" "}
          {gameState?.timeRemainingSec !== null && gameState?.timeRemainingSec !== undefined
            ? `${gameState.timeRemainingSec}s`
            : "-"}
        </span>
        <span className="pill">
          Round {gameState?.round ?? 0}/{gameState?.settings?.maxRounds ?? "-"}
        </span>
      </div>

      {gameError ? <div className="error">{gameError}</div> : null}
    </section>
  );
}

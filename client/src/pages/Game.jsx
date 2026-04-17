import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GameProvider } from "../context/GameContext.jsx";
import { useGame } from "../context/GameContext.jsx";
import { useLobby } from "../context/LobbyContext.jsx";
import GameTopBar from "../components/game/GameTopBar.jsx";
import GameWordCard from "../components/game/GameWordCard.jsx";
import GameGuessCard from "../components/game/GameGuessCard.jsx";
import GameCanvasCard from "../components/game/GameCanvasCard.jsx";
import GameScoreboardCard from "../components/game/GameScoreboardCard.jsx";
import GameOverOverlay from "../components/game/GameOverOverlay.jsx";

const ALLOWED_GAME_ROUTE_STATUSES = new Set([
  "presenter-choosing",
  "in-round",
  "round-ended",
  "game-over"
]);

function GameLayoutContent() {
  const { gameState, isGameOver } = useGame();
  const { lobbyState, lastGameState } = useLobby();
  const navigate = useNavigate();
  const shouldShowWordCard = gameState?.status === "presenter-choosing";
  const resolvedStatus = gameState?.status || lastGameState?.status || null;

  useEffect(() => {
    if (!lobbyState?.id) {
      navigate("/", { replace: true });
      return;
    }

    if (resolvedStatus && !ALLOWED_GAME_ROUTE_STATUSES.has(resolvedStatus)) {
      navigate("/", { replace: true });
    }
  }, [lobbyState?.id, resolvedStatus, navigate]);

  return (
    <div className="game-page">
      <GameTopBar />

      <div className="game-layout">
        <aside className="game-left">
          <GameScoreboardCard />
        </aside>

        <section className="game-center">
          <GameCanvasCard />
          {shouldShowWordCard ? <GameWordCard /> : null}
        </section>

        <aside className="game-right">
          <GameGuessCard />
        </aside>
      </div>

      {isGameOver ? <GameOverOverlay /> : null}
    </div>
  );
}

export default function Game() {
  return (
    <GameProvider>
      <GameLayoutContent />
    </GameProvider>
  );
}

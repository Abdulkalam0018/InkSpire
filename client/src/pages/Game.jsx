import { GameProvider } from "../context/GameContext.jsx";
import { useGame } from "../context/GameContext.jsx";
import GameTopBar from "../components/game/GameTopBar.jsx";
import GameWordCard from "../components/game/GameWordCard.jsx";
import GameGuessCard from "../components/game/GameGuessCard.jsx";
import GameCanvasCard from "../components/game/GameCanvasCard.jsx";
import GameScoreboardCard from "../components/game/GameScoreboardCard.jsx";

function GameLayoutContent() {
  const { gameState } = useGame();
  const shouldShowWordCard = gameState?.status === "presenter-choosing";

  return (
    <div className="game-page">
      <GameTopBar />

      <div className="game-layout">
        <aside className="game-left">
          <GameScoreboardCard />
        </aside>

        <section className="game-center">
          {shouldShowWordCard ? <GameWordCard /> : null}
          <GameCanvasCard />
        </section>

        <aside className="game-right">
          <GameGuessCard />
        </aside>
      </div>
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

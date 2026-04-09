import { GameProvider } from "../context/GameContext.jsx";
import GameHeader from "../components/game/GameHeader.jsx";
import GameStatusCard from "../components/game/GameStatusCard.jsx";
import GameWordCard from "../components/game/GameWordCard.jsx";
import GameGuessCard from "../components/game/GameGuessCard.jsx";
import GameCanvasCard from "../components/game/GameCanvasCard.jsx";
import GameScoreboardCard from "../components/game/GameScoreboardCard.jsx";

export default function Game() {
  return (
    <GameProvider>
      <div className="page">
        <GameHeader />
        <GameStatusCard />
        <GameWordCard />
        <GameGuessCard />
        <GameCanvasCard />
        <GameScoreboardCard />
      </div>
    </GameProvider>
  );
}

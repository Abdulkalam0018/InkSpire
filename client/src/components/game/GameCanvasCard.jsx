import DrawingBoard from "../canvas/DrawingBoard.jsx";
import { useGame } from "../../context/GameContext.jsx";

export default function GameCanvasCard() {
  const { socket, gameState, setGameError } = useGame();

  return (
    <section className="card game-canvas-card">
      <DrawingBoard socket={socket} gameState={gameState} onError={setGameError} />
    </section>
  );
}

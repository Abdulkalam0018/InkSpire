import DrawingBoard from "../canvas/DrawingBoard.jsx";
import { useGame } from "../../context/GameContext.jsx";

export default function GameCanvasCard() {
  const { socket, gameState, setGameError } = useGame();

  return (
    <section className="card">
      <h2>Canvas</h2>
      <DrawingBoard socket={socket} gameState={gameState} onError={setGameError} />
    </section>
  );
}

import { useGame } from "../../context/GameContext.jsx";

export default function GameHeader() {
  const { socketStatus, socketId } = useGame();

  return (
    <header className="page-header">
      <div>
        <h1>InkSpire Game</h1>
        <p className="subtitle">Play the round, track scores, and guess the word.</p>
      </div>
      <div className="status-pill">
        Socket: {socketStatus} {socketId ? `(${socketId.slice(0, 6)})` : ""}
      </div>
    </header>
  );
}

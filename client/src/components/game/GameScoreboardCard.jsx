import { useGame } from "../../context/GameContext.jsx";

export default function GameScoreboardCard() {
  const { gameState } = useGame();

  return (
    <section className="card">
      <h2>Scoreboard</h2>
      {gameState?.scores?.length ? (
        <ul className="list">
          {gameState.scores.map((player) => (
            <li key={player.userId}>
              {player.name}
              {player.userId === gameState.presenterUserId ? " (presenter)" : ""}
              {!player.isOnline ? " (offline)" : ""} - {player.score}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No scores yet.</p>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useGame } from "../../context/GameContext.jsx";

function extractGuessedPlayerName(entry) {
  if (entry?.kind !== "system" || !entry?.message) return null;
  const match = entry.message.match(/^(.+) guessed the word\.$/i);
  if (!match) return null;
  return match[1]?.trim() || null;
}

export default function GameScoreboardCard() {
  const { gameState, chatFeed } = useGame();
  const [guessedNames, setGuessedNames] = useState(() => new Set());

  useEffect(() => {
    if (
      gameState?.reason === "round-start" ||
      gameState?.reason === "next-round" ||
      gameState?.reason === "game-start"
    ) {
      setGuessedNames(new Set());
    }
  }, [gameState?.reason, gameState?.round]);

  useEffect(() => {
    const latest = chatFeed[chatFeed.length - 1];
    const guessedName = extractGuessedPlayerName(latest);
    if (!guessedName) return;

    setGuessedNames((prev) => {
      const next = new Set(prev);
      next.add(guessedName.toLowerCase());
      return next;
    });
  }, [chatFeed]);

  const orderedScores = useMemo(() => {
    const scores = Array.isArray(gameState?.scores) ? [...gameState.scores] : [];
    const presenterUserId = gameState?.presenterUserId;

    scores.sort((a, b) => {
      if (a.userId === presenterUserId) return -1;
      if (b.userId === presenterUserId) return 1;
      return b.score - a.score;
    });

    return scores;
  }, [gameState?.scores, gameState?.presenterUserId]);

  return (
    <section className="card game-scoreboard-card">
      <h2>Players</h2>
      {orderedScores.length ? (
        <ul className="list game-score-list">
          {orderedScores.map((player) => {
            const isPresenter = player.userId === gameState.presenterUserId;
            const isGuessed = guessedNames.has((player.name || "").toLowerCase());
            const avatarChar = (player.name || "P").trim().charAt(0).toUpperCase() || "P";

            return (
            <li
              className={
                `game-score-item${isPresenter ? " is-presenter" : ""}${isGuessed ? " is-guessed" : ""}`
              }
              key={player.userId}
            >
              <span className="game-score-avatar" aria-hidden="true">
                {avatarChar}
              </span>

              <div className="game-score-main">
                <strong className="game-score-name">{player.name}</strong>
                <span className="game-score-meta">
                  {isPresenter ? <span className="game-score-tag">✏ Drawing</span> : null}
                  {isGuessed ? <span className="game-score-tag success">✓ Guessed</span> : null}
                  {!player.isOnline ? <span className="game-score-tag">Offline</span> : null}
                </span>
              </div>

              <strong className="game-score-points">{player.score}</strong>
            </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">No scores yet.</p>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext.jsx";

export default function GameGuessCard() {
  const { gameState, canGuess, submitGuess } = useGame();
  const [guess, setGuess] = useState("");
  const [guessResult, setGuessResult] = useState(null);

  useEffect(() => {
    if (gameState?.reason && gameState.reason !== "tick") {
      setGuessResult(null);
    }
  }, [gameState?.reason]);

  useEffect(() => {
    if (gameState?.status !== "in-round") {
      setGuess("");
    }
  }, [gameState?.status]);

  async function handleGuessSubmit(event) {
    event.preventDefault();
    const result = await submitGuess(guess);

    if (result?.ok === false) return;

    if (result?.correct) {
      setGuessResult("Correct!");
      setGuess("");
    } else {
      setGuessResult("Not quite.");
    }
  }

  return (
    <section className="card">
      <h2>Guess</h2>
      {canGuess ? (
        <form className="grid" onSubmit={handleGuessSubmit}>
          <input
            value={guess}
            onChange={(event) => {
              setGuess(event.target.value);
              setGuessResult(null);
            }}
            placeholder="Your guess"
          />
          <button type="submit" disabled={!guess.trim()}>
            Submit Guess
          </button>
        </form>
      ) : gameState?.isPresenter ? (
        <p className="note">You are the presenter this round.</p>
      ) : (
        <p className="muted">Guesses open when the round starts.</p>
      )}

      {guessResult ? <div className="note">{guessResult}</div> : null}
    </section>
  );
}

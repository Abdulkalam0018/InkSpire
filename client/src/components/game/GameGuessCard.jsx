import { useState } from "react";
import { useGame } from "../../context/GameContext.jsx";

export default function GameGuessCard() {
  const { gameState, canGuess, submitGuess, chatFeed, sendChatMessage } = useGame();
  const [guess, setGuess] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [guessResult, setGuessResult] = useState(null);
  const visibleGuess = gameState?.status === "in-round" ? guess : "";
  const visibleGuessResult = gameState?.reason && gameState.reason !== "tick" ? null : guessResult;

  const canChat =
    Boolean(gameState) &&
    (gameState.status === "presenter-choosing" ||
      gameState.status === "round-ended");

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

  async function handleChatSubmit(event) {
    event.preventDefault();
    if (!chatMessage.trim()) return;

    const result = await sendChatMessage(chatMessage);
    if (result?.ok === false) return;

    setChatMessage("");
  }

  return (
    <section className="card">
      <h2>Guess</h2>
      {canGuess ? (
        <form className="grid" onSubmit={handleGuessSubmit}>
          <input
            value={visibleGuess}
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

      {visibleGuessResult ? <div className="note">{visibleGuessResult}</div> : null}

      <div className="card small" style={{ marginTop: "16px" }}>
        <h3>Chat</h3>
        <div style={{ maxHeight: "180px", overflowY: "auto", marginBottom: "12px" }}>
          {chatFeed.length ? (
            <ul className="list">
              {chatFeed.map((entry, index) => (
                <li key={`${entry.sentAt || "chat"}-${index}`}>
                  {entry.kind === "system"
                    ? `[System] ${entry.message}`
                    : entry.kind === "guess"
                      ? `[Guess] ${entry.name || "Player"}: ${entry.message}`
                      : `${entry.name || "Player"}: ${entry.message}`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No messages yet.</p>
          )}
        </div>

        {canChat ? (
          <form className="row" onSubmit={handleChatSubmit}>
            <input
              value={chatMessage}
              onChange={(event) => setChatMessage(event.target.value)}
              placeholder="Say something"
            />
            <button type="submit" disabled={!chatMessage.trim()}>
              Send
            </button>
          </form>
        ) : gameState?.status === "in-round" ? (
          <p className="muted">Public chat is paused during active rounds. Use the guess box above.</p>
        ) : (
          <p className="muted">Chat opens when the game starts.</p>
        )}
      </div>
    </section>
  );
}

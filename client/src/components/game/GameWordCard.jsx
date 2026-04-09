import { useGame } from "../../context/GameContext.jsx";

export default function GameWordCard() {
  const { gameState, chooseWord } = useGame();

  return (
    <section className="card">
      <h2>Word</h2>
      {gameState?.word ? (
        <p className="subtitle" style={{ fontSize: "1.4rem", letterSpacing: "0.2rem" }}>
          {gameState.word}
        </p>
      ) : (
        <p className="muted">No word selected yet.</p>
      )}

      {gameState?.status === "presenter-choosing" ? (
        gameState.isPresenter ? (
          <div className="grid" style={{ marginTop: "16px" }}>
            <p className="note">Choose a word to start the round.</p>
            <div className="row">
              {(gameState.wordOptions || []).map((option) => (
                <button key={option} onClick={() => chooseWord(option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="note">Waiting for the presenter to choose a word.</p>
        )
      ) : null}
    </section>
  );
}

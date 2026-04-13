import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../context/GameContext.jsx";

function buildWordHint(gameState, hintState) {
  if (!gameState) return "_ _ _ _";
  if (gameState.isPresenter && gameState.word) return gameState.word.toUpperCase();
  if (hintState?.mask) return hintState.mask;
  if (typeof gameState.wordLength === "number" && gameState.wordLength > 0) {
    return Array.from({ length: gameState.wordLength }).map(() => "_").join(" ");
  }
  return "_ _ _ _";
}

export default function GameTopBar() {
  const { gameState, hintState, gameError, presenterTimeoutNotice, wordReveal } = useGame();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);

  const wordHint = useMemo(() => buildWordHint(gameState, hintState), [gameState, hintState]);

  return (
    <section className="card game-topbar fade-up">
      <div className="game-topbar-row">
        <div className="game-clock-block">
          <strong className="game-clock-value">
            {gameState?.timeRemainingSec !== null && gameState?.timeRemainingSec !== undefined
              ? `${gameState.timeRemainingSec}s`
              : "--"}
          </strong>
        </div>

        <div className="game-hint-block">
          <strong className="game-hint-value">{wordHint}</strong>
        </div>

        <div className="game-round-block">
          <span className="game-round-value">
            Round {gameState?.round ?? 0}/{gameState?.settings?.maxRounds ?? "-"}
          </span>

          <div className="game-menu-wrap">
            <button
              type="button"
              className="secondary game-menu-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Open game menu"
            >
              ⚙
            </button>

            {isMenuOpen ? (
              <div className="game-menu-popover">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setIsSoundOn((prev) => !prev)}
                >
                  {isSoundOn ? "Mute Sound" : "Unmute Sound"}
                </button>
                <button type="button" className="secondary" onClick={() => navigate("/")}>
                  Leave Room
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {presenterTimeoutNotice ? (
        <div className="note">Presenter timed out. A word was auto-selected.</div>
      ) : null}
      {wordReveal?.word ? <div className="note">Word revealed: {wordReveal.word}</div> : null}
      {gameError ? <div className="error">{gameError}</div> : null}
    </section>
  );
}

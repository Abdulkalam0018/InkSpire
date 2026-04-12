import { useState } from "react";
import { useLobby } from "../../context/LobbyContext.jsx";

function normalizeLobbyCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export default function LandingHero() {
  const { createLobby, joinLobby, leaveLobby, lobbyState, lobbyError, clearLobbyError } = useLobby();
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState("");

  function handleCodeChange(event) {
    clearLobbyError();
    setJoinCode(normalizeLobbyCode(event.target.value));
  }

  function handleNameChange(event) {
    clearLobbyError();
    setDisplayName(event.target.value);
  }

  function handleCreateLobby() {
    clearLobbyError();
    createLobby({ displayName });
  }

  function handleJoinLobby(event) {
    event.preventDefault();
    clearLobbyError();
    joinLobby({
      lobbyId: joinCode,
      displayName
    });
  }

  function handleLeaveLobby() {
    clearLobbyError();
    leaveLobby();
  }

  return (
    <section className="landing-hero card fade-up">
      <span className="landing-kicker pulse">Realtime Party Sketch Arena</span>
      <h1 className="landing-title gradient-text float">Inkspire</h1>
      <p className="landing-subtitle">
        Jump into a neon sketch showdown. Create a room instantly or punch in a lobby code and
        out-guess everyone.
      </p>

      <form className="landing-actions" onSubmit={handleJoinLobby}>
        <span className="landing-label">Lobby code</span>
        <div className="landing-action-row">
          <input
            className="landing-input"
            value={joinCode}
            onChange={handleCodeChange}
            placeholder="ENTER LOBBY CODE"
            autoComplete="off"
            maxLength={12}
          />
          <button type="button" className="btn-neon" onClick={handleCreateLobby}>
            Create Lobby
          </button>
          <button type="submit" className="btn-neon join" disabled={!joinCode.trim()}>
            Join Lobby
          </button>
        </div>
      </form>

      <div className="landing-meta">
        <label className="field compact">
          <span className="landing-meta-label">Display name (optional)</span>
          <input
            value={displayName}
            onChange={handleNameChange}
            placeholder="How should others see you?"
            autoComplete="off"
          />
        </label>

        {lobbyState ? (
          <button
            type="button"
            className="secondary landing-leave"
            onClick={handleLeaveLobby}
          >
            Leave Current
          </button>
        ) : null}
      </div>

      {lobbyState ? (
        <div className="landing-lobby-hint">
          <span className="pill">Current Lobby: {lobbyState.id}</span>
          <span className="pill">
            Players: {lobbyState.members.length}/{lobbyState.settings.maxPlayers}
          </span>
        </div>
      ) : null}

      {lobbyError ? <div className="error">{lobbyError}</div> : null}
    </section>
  );
}

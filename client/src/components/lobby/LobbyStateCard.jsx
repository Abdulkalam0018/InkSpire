import { useLobby } from "../../context/LobbyContext.jsx";

export default function LobbyStateCard() {
  const { lobbyState, isAdmin, startGame, leaveLobby } = useLobby();

  function handleStartGame() {
    startGame({ lobbyId: lobbyState?.id });
  }

  function handleLeaveLobby() {
    leaveLobby();
  }

  return (
    <section className="card lobby-state-card">
      <h2>Lobby State</h2>
      {lobbyState ? (
        <div className="lobby-state-content">
          <div className="pill-row lobby-state-pills">
            <span className="pill">Code: {lobbyState.id}</span>
            <span className="pill">
              Members: {lobbyState.members.length}/{lobbyState.settings.maxPlayers}
            </span>
            <span className="pill">
              Privacy: {lobbyState.settings.isPrivate ? "Private" : "Public"}
            </span>
          </div>

          <div className="lobby-state-panels">
            <div className="card small lobby-state-panel">
              <h3>Members</h3>
              <ul className="list lobby-member-list">
                {lobbyState.members.map((member) => (
                  <li className="lobby-member-item" key={member.userId}>
                    {member.name}
                    {member.userId === lobbyState.adminUserId ? " (admin)" : ""}
                    {member.isOnline ? "" : " (offline)"}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card small lobby-state-panel">
              <h3>Game Controls</h3>
              <div className="grid lobby-controls-grid">
                <div className="lobby-controls-actions">
                  <button
                    onClick={handleStartGame}
                    disabled={!isAdmin || lobbyState.members.length < 2}
                  >
                    Start Game
                  </button>
                  <button className="secondary" onClick={handleLeaveLobby}>
                    Leave Lobby
                  </button>
                </div>
                {!isAdmin ? (
                  <div className="note">Only the lobby admin can manage the game.</div>
                ) : null}
                {lobbyState.members.length < 2 ? (
                  <div className="note">Need at least 2 players to start.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="muted lobby-state-empty">You are not in a lobby yet.</p>
      )}
    </section>
  );
}

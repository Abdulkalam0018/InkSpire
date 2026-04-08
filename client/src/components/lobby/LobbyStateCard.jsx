import { useEffect, useState } from "react";
import { useLobby } from "../../context/LobbyContext.jsx";

const DEFAULT_MAX_PLAYERS = 8;

export default function LobbyStateCard() {
  const { lobbyState, isAdmin, updateLobbySettings, startGame, stopGame } = useLobby();

  const [settingsDraft, setSettingsDraft] = useState({
    name: "",
    maxPlayers: DEFAULT_MAX_PLAYERS,
    isPrivate: false
  });

  useEffect(() => {
    if (!lobbyState?.settings) return;

    setSettingsDraft({
      name: lobbyState.settings.name || "",
      maxPlayers: lobbyState.settings.maxPlayers || DEFAULT_MAX_PLAYERS,
      isPrivate: Boolean(lobbyState.settings.isPrivate)
    });
  }, [lobbyState]);

  function handleUpdateSettings() {
    updateLobbySettings({
      lobbyId: lobbyState?.id,
      settings: {
        name: settingsDraft.name,
        maxPlayers: Number(settingsDraft.maxPlayers),
        isPrivate: settingsDraft.isPrivate
      }
    });
  }

  function handleStartGame() {
    startGame({ lobbyId: lobbyState?.id });
  }

  function handleStopGame() {
    stopGame({ lobbyId: lobbyState?.id });
  }

  return (
    <section className="card">
      <h2>Lobby State</h2>
      {lobbyState ? (
        <div className="grid">
          <div className="pill-row">
            <span className="pill">Code: {lobbyState.id}</span>
            <span className="pill">
              Members: {lobbyState.members.length}/{lobbyState.settings.maxPlayers}
            </span>
            <span className="pill">
              Privacy: {lobbyState.settings.isPrivate ? "Private" : "Public"}
            </span>
          </div>

          <div className="card small">
            <h3>Members</h3>
            <ul className="list">
              {lobbyState.members.map((member) => (
                <li key={member.userId}>
                  {member.name}
                  {member.userId === lobbyState.adminUserId ? " (admin)" : ""}
                  {member.isOnline ? "" : " (offline)"}
                </li>
              ))}
            </ul>
          </div>

          <div className="card small">
            <h3>Settings</h3>
            <div className="grid">
              <label className="field">
                <span>Name</span>
                <input
                  value={settingsDraft.name}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={!isAdmin}
                />
              </label>
              <label className="field">
                <span>Max Players</span>
                <input
                  type="number"
                  min="2"
                  max="32"
                  value={settingsDraft.maxPlayers}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      maxPlayers: e.target.value
                    }))
                  }
                  disabled={!isAdmin}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settingsDraft.isPrivate}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      isPrivate: e.target.checked
                    }))
                  }
                  disabled={!isAdmin}
                />
                Private lobby
              </label>
              <button onClick={handleUpdateSettings} disabled={!isAdmin}>
                Update Settings
              </button>
              {!isAdmin ? (
                <div className="note">Only the lobby admin can update settings.</div>
              ) : null}
            </div>
          </div>

          <div className="card small">
            <h3>Game Controls</h3>
            <div className="grid">
              <button
                onClick={handleStartGame}
                disabled={!isAdmin || lobbyState.members.length < 2}
              >
                Start Game
              </button>
              <button className="secondary" onClick={handleStopGame} disabled={!isAdmin}>
                Stop Game
              </button>
              {!isAdmin ? (
                <div className="note">Only the lobby admin can manage the game.</div>
              ) : null}
              {lobbyState.members.length < 2 ? (
                <div className="note">Need at least 2 players to start.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="muted">You are not in a lobby yet.</p>
      )}
    </section>
  );
}

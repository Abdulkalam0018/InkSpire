import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext.jsx";

const DEFAULT_MAX_PLAYERS = 8;

export default function Home() {
  const { socket, isConnected, isReconnecting, connectionError } = useSocket();
  const navigate = useNavigate();

  const [lobbyState, setLobbyState] = useState(null);
  const [lobbyError, setLobbyError] = useState(null);

  // Shared display name for create/join (optional).
  const [displayName, setDisplayName] = useState("");

  // Create form state.
  const [createName, setCreateName] = useState("");
  const [createMaxPlayers, setCreateMaxPlayers] = useState(DEFAULT_MAX_PLAYERS);
  const [createPrivate, setCreatePrivate] = useState(false);

  // Join form state.
  const [joinCode, setJoinCode] = useState("");

  // Settings form state (admin-only).
  const [settingsDraft, setSettingsDraft] = useState({
    name: "",
    maxPlayers: DEFAULT_MAX_PLAYERS,
    isPrivate: false
  });

  const socketStatus = isConnected ? "connected" : isReconnecting ? "reconnecting" : "disconnected";
  const socketId = socket?.id || null;

  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = () => {
      setLobbyState(null);
    };

    const handleLobbyState = (state) => {
      setLobbyState(state);
      setLobbyError(null);
    };

    const handleLobbyLeft = () => {
      setLobbyState(null);
    };

    const handleLobbyError = (err) => {
      setLobbyError(err?.message || "Lobby error");
    };

    const handleGameState = (state) => {
      if (!state) return;
      if (state.status && state.status !== "idle") {
        navigate("/game");
      }
    };

    socket.on("disconnect", handleDisconnect);
    socket.on("lobby:state", handleLobbyState);
    socket.on("lobby:left", handleLobbyLeft);
    socket.on("lobby:error", handleLobbyError);
    socket.on("game:state", handleGameState);

    return () => {
      socket.off("disconnect", handleDisconnect);
      socket.off("lobby:state", handleLobbyState);
      socket.off("lobby:left", handleLobbyLeft);
      socket.off("lobby:error", handleLobbyError);
      socket.off("game:state", handleGameState);
    };
  }, [socket, navigate]);

  useEffect(() => {
    if (connectionError) {
      setLobbyError(connectionError);
    }
  }, [connectionError]);

  useEffect(() => {
    // Keep the settings form in sync with the current lobby.
    if (lobbyState?.settings) {
      setSettingsDraft({
        name: lobbyState.settings.name || "",
        maxPlayers: lobbyState.settings.maxPlayers || DEFAULT_MAX_PLAYERS,
        isPrivate: Boolean(lobbyState.settings.isPrivate)
      });
    }
  }, [lobbyState]);

  useEffect(() => {
    if (!socket || !lobbyState?.id) return;
    socket.emit("game:sync");
  }, [socket, lobbyState?.id]);

  useEffect(() => {
    // This return function runs when the Home component unmounts 
    // (e.g., the user navigates to another page on your site)
    return () => {
      if (socket && isConnected) {
        socket.emit("lobby:leave");
      }
    };
  }, [socket, isConnected]);

  const isAdmin =
    Boolean(lobbyState) && Boolean(socketId) && lobbyState.adminSocketId === socketId;

  function emitWithAck(event, payload) {
    if (!socket || !isConnected) {
      setLobbyError("Socket not connected");
      return;
    }

    socket.emit(event, payload, (res) => {
      if (res?.ok === false) {
        setLobbyError(res?.error || "Lobby error");
      }
    });
  }

  function handleCreateLobby() {
    emitWithAck("lobby:create", {
      displayName,
      settings: {
        name: createName,
        maxPlayers: Number(createMaxPlayers),
        isPrivate: createPrivate
      }
    });
  }

  function handleJoinLobby() {
    emitWithAck("lobby:join", {
      lobbyId: joinCode.trim(),
      displayName
    });
  }

  function handleLeaveLobby() {
    emitWithAck("lobby:leave");
  }

  function handleUpdateSettings() {
    emitWithAck("lobby:updateSettings", {
      lobbyId: lobbyState?.id,
      settings: {
        name: settingsDraft.name,
        maxPlayers: Number(settingsDraft.maxPlayers),
        isPrivate: settingsDraft.isPrivate
      }
    });
  }

  function handleStartGame() {
    emitWithAck("game:start", { lobbyId: lobbyState?.id });
  }

  function handleStopGame() {
    emitWithAck("game:stop", { lobbyId: lobbyState?.id });
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>InkSpire Lobby</h1>
          <p className="subtitle">
            Create or join a lobby, then manage settings in real time.
          </p>
        </div>
        <div className="status-pill">
          Socket: {socketStatus} {socketId ? `(${socketId.slice(0, 6)})` : ""}
        </div>
      </header>

      <section className="card">
        <h2>Lobby Actions</h2>

        <div className="grid">
          <label className="field">
            <span>Display name (optional)</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Player name"
            />
          </label>

          <div className="row">
            <div className="card small">
              <h3>Create Lobby</h3>
              <div className="grid">
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Lobby name"
                />
                <input
                  type="number"
                  min="2"
                  max="32"
                  value={createMaxPlayers}
                  onChange={(e) => setCreateMaxPlayers(e.target.value)}
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={createPrivate}
                    onChange={(e) => setCreatePrivate(e.target.checked)}
                  />
                  Private lobby
                </label>
                <button onClick={handleCreateLobby}>Create</button>
              </div>
            </div>

            <div className="card small">
              <h3>Join Lobby</h3>
              <div className="grid">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Lobby code"
                />
                <button onClick={handleJoinLobby}>Join</button>
                <button className="secondary" onClick={handleLeaveLobby}>
                  Leave Current
                </button>
              </div>
            </div>
          </div>

          {lobbyError ? <div className="error">{lobbyError}</div> : null}
        </div>
      </section>

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
                  <li key={member.socketId}>
                    {member.name}
                    {member.socketId === lobbyState.adminSocketId ? " (admin)" : ""}
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
    </div>
  );
}

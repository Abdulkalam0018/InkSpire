import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const DEFAULT_MAX_PLAYERS = 8;

export default function Home() {
  const [health, setHealth] = useState(null);
  const [authTest, setAuthTest] = useState(null);

  const [socket, setSocket] = useState(null);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [socketId, setSocketId] = useState(null);
  const [socketMsg, setSocketMsg] = useState(null);

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

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "error" }));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${API_BASE}/api/auth/test`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then(setAuthTest)
      .catch(() => setAuthTest({ ok: false }));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const socketClient = io(API_BASE, {
      transports: ["websocket"],
      auth: token ? { token } : {}
    });

    setSocket(socketClient);

    socketClient.on("connect", () => {
      setSocketStatus("connected");
      setSocketId(socketClient.id);
    });

    socketClient.on("disconnect", () => {
      setSocketStatus("disconnected");
      setSocketId(null);
      setLobbyState(null);
    });

    socketClient.on("server:hello", (msg) => setSocketMsg(msg.message));
    socketClient.emit("client:ping");
    socketClient.on("server:pong", () => setSocketMsg("pong received"));

    socketClient.on("lobby:state", (state) => {
      setLobbyState(state);
      setLobbyError(null);
    });

    socketClient.on("lobby:left", () => {
      setLobbyState(null);
    });

    socketClient.on("lobby:error", (err) => {
      setLobbyError(err?.message || "Lobby error");
    });

    return () => socketClient.disconnect();
  }, []);

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

  const isAdmin =
    Boolean(lobbyState) && Boolean(socketId) && lobbyState.adminSocketId === socketId;

  function emitWithAck(event, payload) {
    if (!socket || socketStatus !== "connected") {
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
              placeholder="Guest name"
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
          </div>
        ) : (
          <p className="muted">You are not in a lobby yet.</p>
        )}
      </section>

      <section className="card">
        <h2>System Checks</h2>
        <pre>Health: {JSON.stringify(health, null, 2)}</pre>
        <pre>Auth Test: {JSON.stringify(authTest, null, 2)}</pre>
        <pre>Socket: {JSON.stringify(socketMsg, null, 2)}</pre>
      </section>
    </div>
  );
}
